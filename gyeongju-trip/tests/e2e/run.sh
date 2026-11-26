#!/usr/bin/env bash
# 전체 테스트: 단위 → DB(RLS) → 브라우저 E2E
# 필요: 로컬 Postgres(사용자 postgres / 비밀번호 PGPASSWORD, 기본 postgres), Playwright+Chromium
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGPASSWORD=${PGPASSWORD:-postgres}
npx vitest run
bash tests/db/reset.sh > /dev/null
node --test tests/db/rls.test.mjs
bash tests/db/reset.sh > /dev/null

ANON=$(node -e "import('./tests/e2e/mock-supabase.mjs').then(m=>{console.log(m.ANON_KEY);process.exit(0)})")
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir dist-local > /dev/null
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=$ANON npx vite build --outDir dist-e2e > /dev/null

node tests/e2e/mock-supabase.mjs > /dev/null & P1=$!
npx vite preview --outDir dist-local --port 4173 --strictPort > /dev/null & P2=$!
npx vite preview --outDir dist-e2e --port 4174 --strictPort > /dev/null & P3=$!
trap 'kill $P1 $P2 $P3 2>/dev/null' EXIT
sleep 2
timeout 240 node tests/e2e/app.e2e.mjs
