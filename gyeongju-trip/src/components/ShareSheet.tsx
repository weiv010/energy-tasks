import { useCallback, useEffect, useState } from 'react';
import type { SupabaseBackend } from '../lib/backend';
import { shareUrl } from '../lib/backend';
import type { ShareLink } from '../lib/types';
import { Sheet } from './ui';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function ShareSheet({
  open,
  onClose,
  backend,
  tripId,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  backend: SupabaseBackend | null;
  tripId: string;
  notify: (m: string, t?: 'info' | 'error') => void;
}) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!backend) return;
    try {
      setLinks(await backend.listShareLinks(tripId));
    } catch (e) {
      notify(`공유 링크를 불러오지 못했어요: ${(e as Error).message}`, 'error');
    }
  }, [backend, tripId, notify]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const create = async () => {
    if (!backend) return;
    setBusy(true);
    try {
      const link = await backend.createShareLink(tripId);
      await refresh();
      const ok = await copyText(shareUrl(link.token));
      notify(ok ? '새 공유 링크를 만들고 복사했어요 🎁' : '새 공유 링크를 만들었어요');
    } catch (e) {
      notify(`공유 링크 생성 실패: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (l: ShareLink) => {
    if (!backend || !confirm('이 링크를 비활성화할까요?\n이 링크로는 더 이상 여행을 볼 수 없게 돼요.')) return;
    try {
      await backend.revokeShareLink(l.id);
      await refresh();
      notify('링크를 비활성화했어요');
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const active = links?.filter((l) => !l.revoked_at) ?? [];
  const revoked = links?.filter((l) => l.revoked_at) ?? [];

  return (
    <Sheet open={open} onClose={onClose} title="🔗 여행 공유하기">
      {!backend ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-2xl border border-butter bg-butter-soft p-3">
            ⚠️ 아직 서버(Supabase)가 연결되지 않아 <b>공유 링크를 만들 수 없어요.</b> 지금은 이 브라우저에만 저장되는 미리보기 모드예요.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Supabase 프로젝트를 만들고 <code>supabase/schema.sql</code>을 SQL Editor에서 실행</li>
            <li>Authentication에서 관리자 계정(이메일/비밀번호)을 직접 생성하고 회원가입은 끄기</li>
            <li>
              <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> 환경 변수 설정 후 다시 배포
            </li>
          </ol>
          <p className="text-cocoa-soft">자세한 방법은 프로젝트의 README.md를 참고해주세요.</p>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-cocoa-soft">
            링크를 받은 사람은 로그인 없이 <b className="text-cocoa">보기만</b> 할 수 있어요. 수정·삭제·체크는 관리자만 가능해요.
          </p>
          <button className="btn-primary w-full !py-3" onClick={create} disabled={busy}>
            {busy ? '만드는 중…' : '✨ 새 공유 링크 만들기'}
          </button>
          {links === null && <p className="text-center text-cocoa-soft">불러오는 중…</p>}
          {active.length > 0 && (
            <div className="space-y-2">
              <h4 className="hand text-lg font-bold">사용 중인 링크</h4>
              {active.map((l) => (
                <div key={l.id} className="rounded-2xl border border-sage bg-sage-soft/50 p-3" data-testid="share-link">
                  <div className="break-all font-mono text-xs" data-testid="share-url">{shareUrl(l.token)}</div>
                  <div className="mt-1 text-[11px] text-cocoa-soft">{new Date(l.created_at).toLocaleString('ko-KR')} 생성</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-sage !py-1.5 text-xs" onClick={async () => notify((await copyText(shareUrl(l.token))) ? '링크를 복사했어요 📋' : '복사하지 못했어요. 직접 선택해 복사해주세요', 'info')}>📋 복사</button>
                    <a className="btn-ghost !py-1.5 text-xs" href={shareUrl(l.token)} target="_blank" rel="noopener noreferrer">열어보기</a>
                    <button className="btn-ghost !py-1.5 text-xs !text-berry-dark" onClick={() => revoke(l)}>비활성화</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {links && active.length === 0 && <p className="text-center text-cocoa-soft">사용 중인 공유 링크가 없어요</p>}
          {revoked.length > 0 && (
            <details className="text-xs text-cocoa-soft">
              <summary className="cursor-pointer">비활성화된 링크 {revoked.length}개</summary>
              <ul className="mt-2 space-y-1">
                {revoked.map((l) => (
                  <li key={l.id} className="break-all font-mono line-through opacity-60">{shareUrl(l.token)}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Sheet>
  );
}
