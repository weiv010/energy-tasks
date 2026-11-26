// 테스트 전용 Supabase 대역 서버.
// supabase-js 가 보내는 Auth(/auth/v1) · PostgREST(/rest/v1) 요청 중 앱이 쓰는 부분만 구현하고,
// 쿼리는 실제 Postgres 에서 Supabase 와 같은 방식(SET ROLE + request.jwt.claims)으로 실행해 RLS 를 그대로 적용한다.
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

pg.types.setTypeParser(1082, (v) => v); // date → 'YYYY-MM-DD'
const PORT = Number(process.env.MOCK_PORT ?? 54321);
const SECRET = 'local-test-secret-not-for-production';
const pool = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.PGPASSWORD ?? 'postgres', database: 'trip_test' });

export const USERS = {
  'admin@test.local': { id: '11111111-1111-4111-8111-111111111111', password: 'admin-pass-1234' },
  'stranger@test.local': { id: '22222222-2222-4222-8222-222222222222', password: 'stranger-pass-1234' },
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function sign(payload) {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64(payload);
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}
function verify(token) {
  const [h, p, s] = String(token).split('.');
  if (!h || !p || !s) return null;
  const exp = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
  if (exp.length !== s.length || !crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(s))) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}
export const ANON_KEY = sign({ role: 'anon', iss: 'mock' });

function session(email) {
  const u = USERS[email];
  const now = Math.floor(Date.now() / 1000);
  const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  return {
    access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email, exp: now + 3600 }),
    token_type: 'bearer', expires_in: 3600, expires_at: now + 3600,
    refresh_token: Buffer.from(email).toString('base64url'), user,
  };
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABLES = new Set(['trips', 'places', 'schedule_items', 'budget_items', 'checklist_categories', 'checklist_items', 'share_links']);
const id = (x) => { if (!IDENT.test(x)) throw Object.assign(new Error(`bad identifier ${x}`), { status: 400 }); return `"${x}"`; };

async function run(claims, sql, params) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const role = claims?.role === 'authenticated' ? 'authenticated' : 'anon';
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims ?? { role: 'anon' })]);
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

function parseQuery(url) {
  const where = [];
  const params = [];
  let order = '';
  let limit = '';
  let select = null;
  for (const [k, v] of url.searchParams) {
    if (k === 'columns') continue; // 일괄 insert 컬럼 힌트 (본문 키를 그대로 사용)
    if (k === 'select') select = v === '*' ? '*' : v.split(',').map(id).join(',');
    else if (k === 'order') {
      order = ' order by ' + v.split(',').map((o) => {
        const [col, dir = 'asc', nulls] = o.split('.');
        return `${id(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`;
      }).join(',');
    } else if (k === 'limit') limit = ` limit ${Number(v) | 0}`;
    else if (v.startsWith('eq.')) {
      params.push(v.slice(3));
      where.push(`${id(k)}::text = $${params.length}`);
    } else throw Object.assign(new Error(`unsupported filter ${k}=${v}`), { status: 400 });
  }
  return { where: where.length ? ' where ' + where.join(' and ') : '', params, order, limit, select };
}

async function handleRest(req, res, url, claims, body) {
  const path = url.pathname.replace(/^\/rest\/v1\//, '');
  const prefer = String(req.headers.prefer ?? '');
  const single = String(req.headers.accept ?? '').includes('vnd.pgrst.object');
  const send = (status, data) => {
    if (single && Array.isArray(data)) {
      if (data.length !== 1) return json(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
      data = data[0];
    }
    json(res, status, data);
  };

  if (path.startsWith('rpc/')) {
    const fn = path.slice(4);
    if (!['get_shared_trip', 'create_trip_with_data'].includes(fn)) return json(res, 404, { message: 'function not found' });
    const keys = Object.keys(body ?? {});
    const args = keys.map((k, i) => id(k) + ' => $' + (i + 1)).join(', ');
    const r = await run(claims, 'select public.' + id(fn) + '(' + args + ') as d', keys.map((k) => body[k]));
    return json(res, 200, r.rows[0].d);
  }
  if (!TABLES.has(path)) return json(res, 404, { message: 'relation not found' });
  const t = `public.${id(path)}`;
  const q = parseQuery(url);
  const wantRows = prefer.includes('return=representation') || q.select;
  const returning = wantRows ? ` returning ${q.select ?? '*'}` : '';

  if (req.method === 'GET') {
    const r = await run(claims, `select ${q.select ?? '*'} from ${t}${q.where}${q.order}${q.limit}`, q.params);
    return send(200, r.rows);
  }
  if (req.method === 'POST') {
    const rows = Array.isArray(body) ? body : [body];
    const out = [];
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => row[c]);
      const sql = cols.length
        ? `insert into ${t} (${cols.map(id).join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')})${returning}`
        : `insert into ${t} default values${returning}`;
      out.push(...(await run(claims, sql, vals)).rows);
    }
    return wantRows ? send(201, out) : (res.writeHead(201, cors()), res.end());
  }
  if (req.method === 'PATCH') {
    if (!q.where) return json(res, 400, { message: 'UPDATE requires a WHERE clause' });
    const cols = Object.keys(body);
    const off = q.params.length;
    const sql = `update ${t} set ${cols.map((c, i) => `${id(c)} = $${off + i + 1}`).join(',')}${q.where}${returning}`;
    const r = await run(claims, sql, [...q.params, ...cols.map((c) => body[c])]);
    return wantRows ? send(200, r.rows) : (res.writeHead(204, cors()), res.end());
  }
  if (req.method === 'DELETE') {
    if (!q.where) return json(res, 400, { message: 'DELETE requires a WHERE clause' });
    const r = await run(claims, `delete from ${t}${q.where}${returning}`, q.params);
    return wantRows ? send(200, r.rows) : (res.writeHead(204, cors()), res.end());
  }
  json(res, 405, { message: 'method not allowed' });
}

const cors = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'content-range',
});
function json(res, status, data) {
  res.writeHead(status, { ...cors(), 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export const requestLog = [];

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors()), res.end();
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let raw = '';
  for await (const ch of req) raw += ch;
  const body = raw ? JSON.parse(raw) : null;
  // PostgREST 처럼 apikey 는 반드시 있어야 하고, Authorization 의 JWT 로 역할을 정한다
  const apikey = req.headers.apikey;
  if (!verify(apikey)) return json(res, 401, { message: 'Invalid API key' });
  const bearer = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const claims = verify(bearer || apikey);
  if (!claims) return json(res, 401, { message: 'JWT invalid' });
  requestLog.push(`${req.method} ${url.pathname} role=${claims.role}`);
  try {
    if (url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = USERS[body?.email];
        if (!u || u.password !== body?.password) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials', code: 'invalid_credentials' });
        return json(res, 200, session(body.email));
      }
      if (grant === 'refresh_token') {
        const email = Buffer.from(String(body?.refresh_token ?? ''), 'base64url').toString();
        if (!USERS[email]) return json(res, 400, { message: 'Invalid Refresh Token' });
        return json(res, 200, session(email));
      }
      return json(res, 400, { message: 'unsupported grant' });
    }
    if (url.pathname === '/auth/v1/user') {
      if (claims.role !== 'authenticated') return json(res, 401, { message: 'not logged in' });
      return json(res, 200, session(claims.email).user);
    }
    if (url.pathname === '/auth/v1/logout') return res.writeHead(204, cors()), res.end();
    if (url.pathname === '/auth/v1/signup') return json(res, 422, { message: 'Signups not allowed for this instance' });
    if (url.pathname.startsWith('/rest/v1/')) return await handleRest(req, res, url, claims, body);
    json(res, 404, { message: 'not found' });
  } catch (e) {
    const status = e.status ?? (e.code === '42501' ? (claims.role === 'anon' ? 401 : 403) : 400);
    json(res, status, { code: e.code, message: e.message });
  }
});

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  server.listen(PORT, () => console.log(`mock supabase on :${PORT}\nANON_KEY=${ANON_KEY}`));
}
export { server };
