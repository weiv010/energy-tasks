#!/usr/bin/env bash
# 로컬 Postgres 에 테스트 DB(trip_test)를 새로 만들고 Supabase 흉내 + schema.sql 을 적용
set -euo pipefail
cd "$(dirname "$0")"
PSQL="psql -v ON_ERROR_STOP=1 -q -h localhost -U postgres"
export PGPASSWORD=${PGPASSWORD:-postgres}
$PSQL -d postgres -c "drop database if exists trip_test with (force)" -c "create database trip_test"
$PSQL -d trip_test -f supabase-emulation.sql
$PSQL -d trip_test -f ../../supabase/schema.sql
# 두 번 실행해도 안전한지 확인
$PSQL -d trip_test -f ../../supabase/schema.sql
$PSQL -d trip_test -c "insert into auth.users values
  ('11111111-1111-4111-8111-111111111111','admin@test.local'),
  ('22222222-2222-4222-8222-222222222222','stranger@test.local')"
echo "trip_test ready"
