-- ════════════════════════════════════════════════════════════════
--  장금이들의 경주 여행 — Supabase 스키마
--  Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전하도록 작성했습니다 (테이블은 없을 때만 생성).
-- ════════════════════════════════════════════════════════════════

-- ───────────── 테이블 ─────────────

create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  title         text not null default '우리 여행',
  start_date    date not null,
  end_date      date not null,
  total_budget  integer not null default 0 check (total_budget >= 0),
  created_at    timestamptz not null default now()
);

create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  name        text not null,
  emoji       text not null default '📍',
  description text not null default '',
  address     text not null default '',
  lat         double precision check (lat between -90 and 90),
  lng         double precision check (lng between -180 and 180),
  sort_order  integer not null default 0
);

create table if not exists public.schedule_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  day         date not null,
  time        text not null check (time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  time_label  text not null default '',
  title       text not null,
  theme       text not null default '',
  details     text not null default '',
  place_id    uuid references public.places(id) on delete set null,
  is_optional boolean not null default false,
  done        boolean not null default false,
  sort_order  integer not null default 0
);

create table if not exists public.budget_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  title       text not null,
  amount      integer not null default 0 check (amount >= 0),
  is_optional boolean not null default false,
  spent       boolean not null default false,
  sort_order  integer not null default 0
);

create table if not exists public.checklist_categories (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  name       text not null,
  emoji      text not null default '🎁',
  sort_order integer not null default 0
);

create table if not exists public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.checklist_categories(id) on delete cascade,
  name        text not null,
  done        boolean not null default false,
  sort_order  integer not null default 0
);

-- 공유 링크: 토큰은 서버에서 생성되는 64자리 난수(hex). 관리자 권한과 무관한 읽기 전용 열쇠.
create table if not exists public.share_links (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  token      text not null unique
             default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
             check (char_length(token) >= 32),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists places_trip_idx on public.places(trip_id);
create index if not exists schedule_trip_idx on public.schedule_items(trip_id);
create index if not exists budget_trip_idx on public.budget_items(trip_id);
create index if not exists cats_trip_idx on public.checklist_categories(trip_id);
create index if not exists items_trip_idx on public.checklist_items(trip_id);
create index if not exists share_trip_idx on public.share_links(trip_id);

-- ───────────── 권한 (GRANT) ─────────────
-- 익명(anon) 사용자는 테이블에 직접 접근할 수 없음. 공유 링크는 아래 get_shared_trip 함수로만 조회.

revoke all on public.trips, public.places, public.schedule_items, public.budget_items,
              public.checklist_categories, public.checklist_items, public.share_links from anon;
grant select, insert, update, delete on public.trips, public.places, public.schedule_items, public.budget_items,
              public.checklist_categories, public.checklist_items, public.share_links to authenticated;

-- ───────────── RLS (행 단위 보안) ─────────────

alter table public.trips                enable row level security;
alter table public.places               enable row level security;
alter table public.schedule_items       enable row level security;
alter table public.budget_items         enable row level security;
alter table public.checklist_categories enable row level security;
alter table public.checklist_items      enable row level security;
alter table public.share_links          enable row level security;

-- 로그인한 사용자가 해당 여행의 소유자인지 확인
create or replace function public.owns_trip(p_trip uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.trips t where t.id = p_trip and t.owner_id = (select auth.uid()));
$$;
revoke all on function public.owns_trip(uuid) from public, anon;
grant execute on function public.owns_trip(uuid) to authenticated;

drop policy if exists "owner full access" on public.trips;
create policy "owner full access" on public.trips
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['places','schedule_items','budget_items','checklist_categories','checklist_items','share_links'] loop
    execute format('drop policy if exists "owner full access" on public.%I', t);
    execute format(
      'create policy "owner full access" on public.%I for all to authenticated
         using (public.owns_trip(trip_id)) with check (public.owns_trip(trip_id))', t);
  end loop;
end $$;

-- ───────────── 공유 링크 조회 (읽기 전용) ─────────────
-- 유효한(비활성화되지 않은) 토큰일 때만 여행 데이터를 JSON 으로 반환. 그 외에는 null.

create or replace function public.get_shared_trip(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_trip uuid;
begin
  if p_token is null or char_length(p_token) < 32 then
    return null;
  end if;

  select s.trip_id into v_trip
  from public.share_links s
  where s.token = p_token and s.revoked_at is null;

  if v_trip is null then
    return null;
  end if;

  return jsonb_build_object(
    'trip', (select jsonb_build_object('id', t.id, 'title', t.title, 'start_date', t.start_date,
                                       'end_date', t.end_date, 'total_budget', t.total_budget)
             from public.trips t where t.id = v_trip),
    'places', coalesce((select jsonb_agg(to_jsonb(p) order by p.sort_order) from public.places p where p.trip_id = v_trip), '[]'::jsonb),
    'schedule', coalesce((select jsonb_agg(to_jsonb(s) order by s.day, s.time, s.sort_order) from public.schedule_items s where s.trip_id = v_trip), '[]'::jsonb),
    'budget', coalesce((select jsonb_agg(to_jsonb(b) order by b.sort_order) from public.budget_items b where b.trip_id = v_trip), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.checklist_categories c where c.trip_id = v_trip), '[]'::jsonb),
    'checklist', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.checklist_items i where i.trip_id = v_trip), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- ───────────── 첫 로그인 시 기본 여행 데이터 생성 (트랜잭션) ─────────────
-- 한 번의 호출로 여행과 모든 항목을 생성. 중간에 실패하면 전부 취소되어 반쪽짜리 데이터가 남지 않음.
-- security invoker 이므로 위의 RLS 가 그대로 적용됨 (자기 소유 여행만 생성 가능).

create or replace function public.create_trip_with_data(p_data jsonb)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.trips (id, title, start_date, end_date, total_budget)
  select r.id, r.title, r.start_date, r.end_date, r.total_budget
  from jsonb_populate_record(null::public.trips, p_data->'trip') r
  returning id into v_id;

  insert into public.places
  select * from jsonb_populate_recordset(null::public.places, coalesce(p_data->'places', '[]'));
  insert into public.checklist_categories
  select * from jsonb_populate_recordset(null::public.checklist_categories, coalesce(p_data->'categories', '[]'));
  insert into public.schedule_items
  select * from jsonb_populate_recordset(null::public.schedule_items, coalesce(p_data->'schedule', '[]'));
  insert into public.budget_items
  select * from jsonb_populate_recordset(null::public.budget_items, coalesce(p_data->'budget', '[]'));
  insert into public.checklist_items
  select * from jsonb_populate_recordset(null::public.checklist_items, coalesce(p_data->'checklist', '[]'));

  return v_id;
end;
$$;
revoke all on function public.create_trip_with_data(jsonb) from public, anon;
grant execute on function public.create_trip_with_data(jsonb) to authenticated;
