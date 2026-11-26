import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSeed } from './seed';
import { TABLE_KEY, type ShareLink, type TableName, type TableRows, type Trip, type TripData } from './types';

export interface Backend {
  kind: 'local' | 'supabase';
  load(): Promise<TripData>;
  updateTrip(id: string, patch: Partial<Trip>): Promise<void>;
  insert<T extends TableName>(table: T, row: TableRows[T]): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<TableRows[T]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
}

/* ───────────────────────── Supabase 설정 ───────────────────────── */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  URL && KEY && /^https?:\/\//.test(URL) && !URL.includes('YOUR-PROJECT'),
);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  if (!client) client = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/* ───────────────────────── 로컬(미리보기) 저장소 ───────────────────────── */

const LOCAL_KEY = 'gyeongju-trip:v1';

export class LocalBackend implements Backend {
  kind = 'local' as const;
  private read(): TripData {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw) as TripData;
    } catch {
      /* 손상된 데이터는 새로 만든다 */
    }
    const seed = createSeed();
    this.write(seed);
    return seed;
  }
  private write(d: TripData) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
  }
  async load() {
    return this.read();
  }
  async updateTrip(_id: string, patch: Partial<Trip>) {
    const d = this.read();
    d.trip = { ...d.trip, ...patch };
    this.write(d);
  }
  async insert<T extends TableName>(table: T, row: TableRows[T]) {
    const d = this.read();
    (d[TABLE_KEY[table]] as TableRows[T][]).push(row);
    this.write(d);
  }
  async update<T extends TableName>(table: T, id: string, patch: Partial<TableRows[T]>) {
    const d = this.read();
    const list = d[TABLE_KEY[table]] as TableRows[T][];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list[i] = { ...list[i], ...patch };
    this.write(d);
  }
  async remove(table: TableName, id: string) {
    const d = this.read();
    const key = TABLE_KEY[table];
    (d as unknown as Record<string, { id: string }[]>)[key] = d[key].filter((r) => r.id !== id);
    // DB 의 ON DELETE 동작과 동일하게 맞춘다
    if (table === 'checklist_categories') d.checklist = d.checklist.filter((c) => c.category_id !== id);
    if (table === 'places') d.schedule = d.schedule.map((s) => (s.place_id === id ? { ...s, place_id: null } : s));
    this.write(d);
  }
}

/* ───────────────────────── Supabase 저장소 (관리자) ───────────────────────── */

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseBackend implements Backend {
  kind = 'supabase' as const;
  constructor(readonly userId: string) {}

  async load(): Promise<TripData> {
    const sb = supabase();
    const trips = check(
      await sb.from('trips').select('id,title,start_date,end_date,total_budget').order('created_at').limit(1),
    ) as Trip[];
    let trip = trips[0];
    if (!trip) {
      try {
        await this.seed();
      } catch (e) {
        // 다른 탭에서 동시에 생성한 경우(owner_id unique) 는 무시하고 다시 불러온다
        if (!/duplicate|unique/i.test(String((e as Error).message))) throw e;
      }
      return this.load();
    }
    const [places, schedule, budget, categories, checklist] = await Promise.all([
      sb.from('places').select('*').eq('trip_id', trip.id).order('sort_order'),
      sb.from('schedule_items').select('*').eq('trip_id', trip.id),
      sb.from('budget_items').select('*').eq('trip_id', trip.id).order('sort_order'),
      sb.from('checklist_categories').select('*').eq('trip_id', trip.id).order('sort_order'),
      sb.from('checklist_items').select('*').eq('trip_id', trip.id).order('sort_order'),
    ]).then((rs) => rs.map(check));
    trip = { ...trip, total_budget: Number(trip.total_budget) };
    return { trip, places, schedule, budget, categories, checklist } as TripData;
  }

  /** 첫 로그인 시 기본 여행 데이터를 서버에 생성 */
  private async seed() {
    // DB 함수 안에서 하나의 트랜잭션으로 생성 → 중간 실패 시 반쪽 데이터가 남지 않음
    check(await supabase().rpc('create_trip_with_data', { p_data: createSeed() }));
  }

  async updateTrip(id: string, patch: Partial<Trip>) {
    const rows = check(await supabase().from('trips').update(patch).eq('id', id).select('id'));
    if (!rows?.length) throw new Error('수정 권한이 없거나 여행을 찾을 수 없습니다.');
  }
  async insert<T extends TableName>(table: T, row: TableRows[T]) {
    check(await supabase().from(table).insert(row as never));
  }
  async update<T extends TableName>(table: T, id: string, patch: Partial<TableRows[T]>) {
    // RLS 로 막힌 업데이트는 에러 없이 0행이 되므로 결과 행 수로 확인한다
    const rows = check(await supabase().from(table).update(patch as never).eq('id', id).select('id'));
    if (!rows?.length) throw new Error('수정 권한이 없거나 항목을 찾을 수 없습니다.');
  }
  async remove(table: TableName, id: string) {
    check(await supabase().from(table).delete().eq('id', id));
  }

  /* 공유 링크 관리 */
  async listShareLinks(tripId: string): Promise<ShareLink[]> {
    return check(
      await supabase()
        .from('share_links')
        .select('id,token,created_at,revoked_at')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false }),
    ) as ShareLink[];
  }
  async createShareLink(tripId: string): Promise<ShareLink> {
    // 토큰은 DB 기본값(서버 측 난수)으로 생성된다
    return check(
      await supabase().from('share_links').insert({ trip_id: tripId }).select('id,token,created_at,revoked_at').single(),
    ) as ShareLink;
  }
  async revokeShareLink(id: string) {
    const rows = check(
      await supabase().from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', id).select('id'),
    );
    if (!rows?.length) throw new Error('공유 링크를 비활성화하지 못했습니다.');
  }
}

/** 공유 링크(읽기 전용) — 로그인 없이 토큰으로 조회 */
export async function loadShared(token: string): Promise<TripData | null> {
  const data = check(await supabase().rpc('get_shared_trip', { p_token: token })) as TripData | null;
  if (!data) return null;
  return { ...data, trip: { ...data.trip, total_budget: Number(data.trip.total_budget) } };
}

export function shareUrl(token: string) {
  return `${window.location.origin}/share/${token}`;
}
