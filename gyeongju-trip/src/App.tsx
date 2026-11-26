import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LocalBackend, SupabaseBackend, isSupabaseConfigured, loadShared, supabase, type Backend } from './lib/backend';
import { useTrip, type TripActions } from './lib/useTrip';
import TripView from './components/TripView';
import ShareSheet from './components/ShareSheet';
import Login from './components/Login';
import BackupSheet from './components/BackupSheet';
import { Toast, Tree } from './components/ui';

type ToastState = { message: string; tone: 'info' | 'error'; key: number } | null;
function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const notify = useCallback((message: string, tone: 'info' | 'error' = 'info') => setToast({ message, tone, key: Date.now() }), []);
  const node = toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />;
  return { notify, node };
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <Tree size={48} />
      {children}
    </div>
  );
}

function Loading({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  return (
    <Centered>
      {error ? (
        <>
          <p className="hand text-2xl font-bold">불러오지 못했어요</p>
          <p className="max-w-sm text-sm text-cocoa-soft">{error}</p>
          {onRetry && <button className="btn-primary" onClick={onRetry}>다시 시도</button>}
        </>
      ) : (
        <p className="hand text-2xl">여행 가방 챙기는 중… 🎒</p>
      )}
    </Centered>
  );
}

/** 편집 가능한 화면 (로컬 미리보기 / 관리자) */
function Editor({ backend, banner, extraActions }: { backend: Backend; banner?: ReactNode; extraActions?: ReactNode }) {
  const { notify, node } = useToast();
  const { data, error, saving, reload, actions } = useTrip(backend, (m) => notify(m, 'error'));
  const [shareOpen, setShareOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    // 다른 기기에서 수정한 내용을 반영
    const onVis = () => document.visibilityState === 'visible' && backend.kind === 'supabase' && void reload();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [backend, reload]);

  if (!data) return <Loading error={error} onRetry={reload} />;

  return (
    <>
      {node}
      <TripView
        data={data}
        actions={actions}
        readOnly={preview}
        notify={notify}
        saving={saving}
        banner={
          <>
            {banner}
            {preview && (
              <div className="sticky top-0 z-[1600] flex items-center justify-center gap-3 bg-sage px-4 py-2 text-sm text-white">
                👀 공유 받은 사람에게 보이는 화면이에요
                <button className="rounded-full bg-white px-3 py-0.5 text-xs text-sage-dark" onClick={() => setPreview(false)}>편집으로 돌아가기</button>
              </div>
            )}
          </>
        }
        headerActions={
          !preview &&
          (backend.kind === 'local' ? (
            extraActions
          ) : (
            <>
              <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => setShareOpen(true)}>🔗 여행 공유하기</button>
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setPreview(true)}>👀 공유 화면 미리보기</button>
              {extraActions}
            </>
          ))
        }
      />
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        backend={backend instanceof SupabaseBackend ? backend : null}
        tripId={data.trip.id}
        notify={notify}
      />
    </>
  );
}

/** 개인용 모드: 로그인 없이 이 브라우저에 저장 */
function LocalApp() {
  const backend = useMemo(() => new LocalBackend(), []);
  const [backupOpen, setBackupOpen] = useState(false);
  return (
    <>
      <Editor
        backend={backend}
        extraActions={
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setBackupOpen(true)}>💾 백업</button>
        }
      />
      <BackupSheet open={backupOpen} onClose={() => setBackupOpen(false)} backend={backend} />
    </>
  );
}

function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id;
  const backend = useMemo(() => (userId ? new SupabaseBackend(userId) : null), [userId]);

  if (session === undefined) return <Loading error={null} />;
  if (!session || !backend) return <Login />;
  return (
    <Editor
      backend={backend}
      extraActions={
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => supabase().auth.signOut()} title={session.user.email ?? ''}>
          로그아웃
        </button>
      }
    />
  );
}

const noop = () => {};
const READONLY_ACTIONS: TripActions = { updateTrip: noop, insert: noop, update: noop, remove: noop };

class SharedBackend implements Backend {
  kind = 'supabase' as const;
  constructor(private token: string) {}
  async load() {
    const d = await loadShared(this.token);
    if (!d) throw new Error('NOT_FOUND');
    return d;
  }
  private deny(): never {
    throw new Error('보기 전용 링크에서는 수정할 수 없어요');
  }
  async updateTrip() { this.deny(); }
  async insert() { this.deny(); }
  async update() { this.deny(); }
  async remove() { this.deny(); }
}

function SharedApp({ token }: { token: string }) {
  const { notify, node } = useToast();
  const backend = useMemo(() => (isSupabaseConfigured ? new SharedBackend(token) : null), [token]);
  const { data, error, reload } = useTrip(backend, (m) => notify(m, 'error'));

  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  if (!backend)
    return (
      <Centered>
        <p className="hand text-2xl font-bold">공유 기능이 아직 설정되지 않았어요</p>
        <p className="text-sm text-cocoa-soft">사이트 관리자가 Supabase 환경 변수를 설정해야 공유 링크를 볼 수 있어요.</p>
      </Centered>
    );
  if (error === 'NOT_FOUND')
    return (
      <Centered>
        <p className="hand text-2xl font-bold">링크를 열 수 없어요 🥲</p>
        <p className="text-sm text-cocoa-soft">공유 링크가 비활성화되었거나 주소가 올바르지 않아요.<br />여행을 공유한 사람에게 새 링크를 요청해주세요.</p>
      </Centered>
    );
  if (!data) return <Loading error={error} onRetry={reload} />;
  return (
    <>
      {node}
      <TripView data={data} actions={READONLY_ACTIONS} readOnly notify={notify} />
    </>
  );
}

export default function App() {
  const share = window.location.pathname.match(/^\/share\/([A-Za-z0-9_-]{16,128})\/?$/);
  if (share) return <SharedApp token={share[1]} />;
  if (window.location.pathname.startsWith('/share'))
    return (
      <Centered>
        <p className="hand text-2xl font-bold">링크를 열 수 없어요 🥲</p>
        <p className="text-sm text-cocoa-soft">공유 링크 주소가 올바르지 않아요.</p>
      </Centered>
    );
  return isSupabaseConfigured ? <AdminApp /> : <LocalApp />;
}
