// 실제 Postgres 에서 RLS / 공유 함수 권한을 검증한다.
// 실행: bash tests/db/reset.sh && node --test tests/db/rls.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const pool = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.PGPASSWORD ?? 'postgres', database: 'trip_test' });

/** Supabase/PostgREST 와 같은 방식으로 역할과 JWT 클레임을 설정한 뒤 쿼리 실행 */
async function as(who, sql, params = []) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    if (who === 'anon') {
      await c.query("set local role anon");
      await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
    } else {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: who, role: 'authenticated' })]);
    }
    const r = await c.query(sql, params);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

let tripId, token, budgetId;

before(async () => {
  const t = await as(ADMIN, "insert into trips (title,start_date,end_date,total_budget) values ('경주','2026-11-29','2026-11-30',300000) returning id, owner_id");
  tripId = t.rows[0].id;
  assert.equal(t.rows[0].owner_id, ADMIN, 'owner_id 는 auth.uid() 로 자동 설정');
  await as(ADMIN, "insert into places (trip_id,name,emoji) values ($1,'첨성대','⭐')", [tripId]);
  budgetId = (await as(ADMIN, "insert into budget_items (trip_id,title,amount) values ($1,'호텔',76500) returning id", [tripId])).rows[0].id;
  const cat = (await as(ADMIN, "insert into checklist_categories (trip_id,name) values ($1,'필수') returning id", [tripId])).rows[0].id;
  await as(ADMIN, "insert into checklist_items (trip_id,category_id,name) values ($1,$2,'휴대폰')", [tripId, cat]);
  await as(ADMIN, "insert into schedule_items (trip_id,day,time,title) values ($1,'2026-11-29','09:30','양산 출발')", [tripId]);
});
after(() => pool.end());

test('관리자는 자기 여행 데이터를 읽고 수정할 수 있다', async () => {
  const r = await as(ADMIN, 'select * from budget_items where trip_id=$1', [tripId]);
  assert.equal(r.rowCount, 1);
  const u = await as(ADMIN, 'update budget_items set spent=true where id=$1 returning spent', [budgetId]);
  assert.equal(u.rows[0].spent, true);
});

test('관리자는 공유 링크를 만들 수 있고 토큰은 서버에서 생성된 64자 난수', async () => {
  const r = await as(ADMIN, 'insert into share_links (trip_id) values ($1) returning token', [tripId]);
  token = r.rows[0].token;
  assert.match(token, /^[0-9a-f]{64}$/);
  const r2 = await as(ADMIN, 'insert into share_links (trip_id) values ($1) returning token', [tripId]);
  assert.notEqual(r2.rows[0].token, token, '링크마다 고유 토큰');
});

test('익명 사용자는 테이블을 직접 읽거나 쓸 수 없다', async () => {
  for (const t of ['trips', 'places', 'schedule_items', 'budget_items', 'checklist_categories', 'checklist_items', 'share_links']) {
    await assert.rejects(as('anon', `select * from ${t}`), /permission denied/, `${t} select`);
  }
  await assert.rejects(as('anon', 'update budget_items set spent=false'), /permission denied/);
  await assert.rejects(as('anon', 'delete from schedule_items'), /permission denied/);
  await assert.rejects(as('anon', "insert into share_links (trip_id) values ($1)", [tripId]), /permission denied/);
  await assert.rejects(as('anon', 'select public.owns_trip($1)', [tripId]), /permission denied/);
});

test('익명 사용자는 유효한 토큰으로 get_shared_trip 을 통해 읽기만 가능', async () => {
  const r = await as('anon', 'select public.get_shared_trip($1) as d', [token]);
  const d = r.rows[0].d;
  assert.equal(d.trip.id, tripId);
  assert.equal(d.trip.total_budget, 300000);
  assert.equal(d.trip.owner_id, undefined, '소유자 ID 는 노출하지 않음');
  assert.equal(d.budget[0].spent, true, '체크 현황이 보임');
  assert.equal(d.places.length, 1);
  assert.equal(d.schedule.length, 1);
  assert.equal(d.checklist.length, 1);
  assert.equal(d.categories.length, 1);
  assert.equal(JSON.stringify(d).includes(token), false, '응답에 토큰/공유링크 정보 없음');
});

test('잘못된/짧은 토큰은 null', async () => {
  for (const bad of ['x'.repeat(64), token.slice(0, 63) + '0', 'short', '', "' or 1=1 --"]) {
    const r = await as('anon', 'select public.get_shared_trip($1) as d', [bad]);
    assert.equal(r.rows[0].d, null, bad);
  }
});

test('다른 로그인 사용자는 관리자 여행을 보거나 수정할 수 없다', async () => {
  assert.equal((await as(STRANGER, 'select * from trips')).rowCount, 0);
  assert.equal((await as(STRANGER, 'select * from budget_items')).rowCount, 0);
  assert.equal((await as(STRANGER, 'select * from share_links')).rowCount, 0, '공유 토큰 목록도 못 봄');
  assert.equal((await as(STRANGER, 'update budget_items set amount=1 where id=$1', [budgetId])).rowCount, 0);
  assert.equal((await as(STRANGER, 'delete from budget_items where id=$1', [budgetId])).rowCount, 0);
  await assert.rejects(
    as(STRANGER, "insert into budget_items (trip_id,title,amount) values ($1,'해킹',1)", [tripId]),
    /row-level security/,
  );
  await assert.rejects(as(STRANGER, 'insert into share_links (trip_id) values ($1)', [tripId]), /row-level security/);
  // 다른 사람 소유로 여행을 만드는 것도 불가
  await assert.rejects(
    as(STRANGER, "insert into trips (owner_id,start_date,end_date) values ($1,'2026-01-01','2026-01-02')", [ADMIN]),
    /row-level security|duplicate/,
  );
  const amt = (await as(ADMIN, 'select amount from budget_items where id=$1', [budgetId])).rows[0].amount;
  assert.equal(amt, 76500, '관리자 데이터 변경 없음');
});

test('공유 토큰을 알아도 로그인 사용자 권한으로 데이터를 수정할 수 없다', async () => {
  // 토큰은 RPC 인자일 뿐 어떤 쓰기 권한과도 연결되지 않음
  const r = await as(STRANGER, 'select public.get_shared_trip($1) as d', [token]);
  assert.ok(r.rows[0].d);
  assert.equal((await as(STRANGER, 'update schedule_items set done=true where trip_id=$1', [tripId])).rowCount, 0);
});

test('관리자는 다른 사용자의 여행으로 항목을 옮길 수 없다', async () => {
  const other = (await as(STRANGER, "insert into trips (start_date,end_date) values ('2026-01-01','2026-01-02') returning id")).rows[0].id;
  await assert.rejects(as(ADMIN, 'update budget_items set trip_id=$1 where id=$2', [other, budgetId]), /row-level security/);
});

test('공유 링크 비활성화 후에는 조회 불가', async () => {
  await as(ADMIN, 'update share_links set revoked_at=now() where token=$1', [token]);
  const r = await as('anon', 'select public.get_shared_trip($1) as d', [token]);
  assert.equal(r.rows[0].d, null);
});

test('잘못된 값은 DB 제약으로 거부', async () => {
  await assert.rejects(as(ADMIN, 'update budget_items set amount=-1 where id=$1', [budgetId]), /check constraint/);
  await assert.rejects(as(ADMIN, "insert into schedule_items (trip_id,day,time,title) values ($1,'2026-11-29','9시','x')", [tripId]), /check constraint/);
  await assert.rejects(as(ADMIN, "insert into trips (start_date,end_date) values ('2026-01-01','2026-01-02')"), /duplicate/, '관리자당 여행 1개');
});

test('카테고리 삭제 시 준비물도 삭제, 장소 삭제 시 일정의 위치만 비워짐', async () => {
  const place = (await as(ADMIN, 'select id from places where trip_id=$1', [tripId])).rows[0].id;
  await as(ADMIN, 'update schedule_items set place_id=$1 where trip_id=$2', [place, tripId]);
  await as(ADMIN, 'delete from places where id=$1', [place]);
  const s = await as(ADMIN, 'select place_id from schedule_items where trip_id=$1', [tripId]);
  assert.equal(s.rows[0].place_id, null);
  await as(ADMIN, 'delete from checklist_categories where trip_id=$1', [tripId]);
  assert.equal((await as(ADMIN, 'select * from checklist_items where trip_id=$1', [tripId])).rowCount, 0);
});

test('create_trip_with_data: 트랜잭션으로 생성, 실패 시 전부 취소, 익명 불가', async () => {
  const U3 = '33333333-3333-4333-8333-333333333333';
  await pool.query("insert into auth.users values ($1,'u3@test.local') on conflict do nothing", [U3]);
  const tid = '44444444-4444-4444-8444-444444444444';
  const bad = {
    trip: { id: tid, title: 't', start_date: '2026-11-29', end_date: '2026-11-30', total_budget: 1000 },
    places: [{ id: '55555555-5555-4555-8555-555555555555', trip_id: tid, name: 'p', emoji: '📍', description: '', address: '', lat: null, lng: null, sort_order: 0 }],
    budget: [{ id: '66666666-6666-4666-8666-666666666666', trip_id: tid, title: 'x', amount: -5, is_optional: false, spent: false, sort_order: 0 }],
  };
  await assert.rejects(as(U3, 'select public.create_trip_with_data($1)', [bad]), /check constraint/);
  assert.equal((await as(U3, 'select * from trips')).rowCount, 0, '실패 시 여행도 생성되지 않음');
  assert.equal((await pool.query('select * from places where trip_id=$1', [tid])).rowCount, 0);
  await assert.rejects(as('anon', 'select public.create_trip_with_data($1)', [bad]), /permission denied/);
  bad.budget[0].amount = 5;
  const r = await as(U3, 'select public.create_trip_with_data($1) as id', [bad]);
  assert.equal(r.rows[0].id, tid);
  const t = await as(U3, 'select owner_id from trips');
  assert.equal(t.rows[0].owner_id, U3, '소유자는 항상 호출한 사용자');
  // 남의 여행 id 로 항목을 끼워 넣는 시도는 RLS 로 거부
  const U4 = '99999999-9999-4999-8999-999999999999';
  await pool.query("insert into auth.users values ($1,'u4@test.local') on conflict do nothing", [U4]);
  const sneaky = { trip: { id: '77777777-7777-4777-8777-777777777777', title: 's', start_date: '2026-01-01', end_date: '2026-01-02', total_budget: 0 }, places: [{ ...bad.places[0], id: '88888888-8888-4888-8888-888888888888', trip_id: tripId }] };
  await assert.rejects(as(U4, 'select public.create_trip_with_data($1)', [sneaky]), /row-level security/);
  assert.equal((await as(U4, 'select * from trips')).rowCount, 0, '거부 시 여행도 롤백');
});
