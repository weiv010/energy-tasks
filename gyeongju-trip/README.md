# 🎄 장금이들의 경주 여행 — 여행 캘린더

2026.11.29(일)–11.30(월) 경주 여행을 위한 모바일 우선 여행 다이어리 겸 플래너입니다.

- **홈**: Leaflet + OpenStreetMap 지도, 시간순 여행 로드맵 (추가/수정/삭제/순서 변경/완료 체크)
- **예산**: 전체 예산·사용 금액·남은 예산, 체크한(실제 지출한) 항목만 사용 금액에 포함, 초과 경고
- **준비물**: 카테고리별 체크리스트, 진행률, 항목·카테고리 추가/수정/삭제
- **공유**: 관리자만 수정 가능. 읽기 전용 공유 링크(랜덤 토큰)는 로그인 없이 보기만 가능하고 비활성화할 수 있음

## 실행 모드

| 모드 | 조건 | 저장 위치 | 공유 |
|---|---|---|---|
| 로컬 미리보기 | Supabase 환경 변수 없음 | 이 브라우저(localStorage) | ❌ 설정 안내만 표시 |
| 관리자 | 환경 변수 설정 + 로그인 | Supabase DB (모든 기기 동기화) | ✅ 링크 생성/비활성화 |
| 공유(보기 전용) | `/share/<토큰>` 접속 | 서버에서 읽기만 | – |

환경 변수가 없을 때는 화면 상단에 "로컬 미리보기 모드" 안내가 표시되고, 공유 버튼을 눌러도 가짜 링크 대신 설정 방법을 보여줍니다.

---

## 1. 로컬에서 실행

```bash
cd gyeongju-trip
npm install
npm run dev          # http://localhost:5173 (환경 변수가 없으면 로컬 미리보기 모드)
```

## 2. 필요한 환경 변수

`.env.example`을 `.env.local`로 복사해서 값을 채웁니다. `.env*` 파일은 git에 올라가지 않습니다.

| 변수 | 값 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Project Settings → API (Data API) |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key | 브라우저에 공개되는 키이며 RLS로 보호됩니다 |

> ⚠️ **`service_role`(secret) 키는 절대 넣지 마세요.** 이 앱은 anon 키만 필요합니다.

## 3. Supabase 프로젝트 만들기

1. https://supabase.com 에 가입 → **New project** (Region: Northeast Asia (Seoul) 추천)
2. 프로젝트가 만들어지면 **Project Settings → API**에서 `Project URL`과 `anon` 키를 복사 → 위 환경 변수에 입력

## 4. 데이터베이스 테이블 만들기

1. Supabase 대시보드 → **SQL Editor** → New query
2. [`supabase/schema.sql`](supabase/schema.sql) 전체를 붙여넣고 **Run**
   - 테이블: `trips`, `places`, `schedule_items`, `budget_items`, `checklist_categories`, `checklist_items`, `share_links`
   - 함수: `get_shared_trip`(공유 조회), `create_trip_with_data`(첫 로그인 시 기본 데이터 생성), `owns_trip`(권한 확인)
   - 여러 번 실행해도 안전합니다
3. 기본 여행 데이터(일정·예산·준비물)는 **관리자가 처음 로그인할 때 자동으로 생성**됩니다

## 5. 권한 정책(RLS)

`schema.sql`이 아래 정책을 자동으로 설정합니다.

| 누가 | 할 수 있는 일 |
|---|---|
| 관리자(로그인, 여행 소유자) | 자기 여행의 모든 데이터 읽기/추가/수정/삭제, 공유 링크 생성·비활성화 |
| 다른 로그인 사용자 | 관리자의 여행에 대해 아무것도 할 수 없음 (자기 여행만 접근) |
| 익명(공유 링크 접속자) | 테이블 직접 접근 **불가**. `get_shared_trip(토큰)` 함수로 **유효한 토큰의 여행만 읽기** |

- 공유 토큰은 DB가 생성하는 64자리 난수이며, 관리자 로그인과 완전히 분리되어 있습니다. 토큰으로는 어떤 쓰기도 할 수 없습니다.
- 링크를 비활성화하면(`revoked_at` 설정) 그 즉시 해당 링크로 조회할 수 없습니다.
- 응답에는 소유자 ID나 다른 공유 토큰이 포함되지 않습니다.

## 6. 관리자 계정 만들기 (중요)

1. **Authentication → Sign In / Providers → Email**: Email 로그인은 켜두고, **"Allow new users to sign up"은 끄기**
   (다른 사람이 가입해도 관리자 여행에는 접근할 수 없지만, 불필요한 계정 생성을 막기 위해 끄는 것을 권장합니다)
2. **Authentication → Users → Add user → Create new user**
   - 이메일 / 비밀번호 입력, **Auto Confirm User** 체크
3. 배포된 사이트 첫 화면에서 이 계정으로 로그인하면 관리자 모드가 됩니다

## 7. Vercel 배포

1. https://vercel.com → **Add New… → Project** → 이 GitHub 저장소 import
2. 설정
   - **Root Directory**: `gyeongju-trip`
   - Framework Preset: **Vite** (자동 감지) / Build Command `npm run build` / Output `dist`
3. **Environment Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가 (Production·Preview 모두)
4. **Deploy**
   - `vercel.json`의 rewrite 설정 덕분에 `/share/<토큰>` 주소를 새로고침해도 정상 동작합니다
   - 환경 변수를 바꾼 뒤에는 **다시 배포(Redeploy)** 해야 반영됩니다 (Vite는 빌드 시점에 값을 넣음)

## 8. 공유 링크 생성 및 테스트

1. 배포 주소(예: `https://내프로젝트.vercel.app`)에 접속 → 관리자 로그인
2. 상단 **🔗 여행 공유하기 → ✨ 새 공유 링크 만들기** → 링크가 자동 복사됨
3. **시크릿 창**(로그인 안 된 상태)에서 링크를 열어 확인
   - 지도·로드맵·예산·준비물이 보이고, 편집 버튼이 없고, 체크박스가 비활성화되어 있어야 정상
4. 관리자 화면에서 아무 항목을 체크한 뒤, 공유 창을 새로고침하면 반영됨
5. **비활성화**를 누른 뒤 공유 창을 새로고침하면 "링크를 열 수 없어요"가 표시되어야 정상
6. 관리자 화면의 **👀 공유 화면 미리보기**로 공유 받은 사람에게 보이는 화면을 바로 확인할 수도 있습니다

---

## 지도와 장소 좌표

- **대릉원·첨성대·동궁과 월지**: OpenStreetMap(Nominatim)에서 확인한 좌표를 기본으로 넣었습니다.
- **지베르니 호텔·꽃길 한복·올리브 카페**: 확인 가능한 좌표가 없어 **임의 좌표를 넣지 않았습니다.** 지도 아래에 "위치 미입력"으로 표시됩니다.
  관리자 모드에서 **📍 장소 관리**를 열고 다음 중 하나로 위치를 지정하세요.
  - 주소 입력 → **좌표 찾기** → 검색 결과 중 맞는 곳 선택
  - 위도/경도 직접 입력 (카카오맵·네이버지도에서 장소를 찾아 좌표를 복사)
  - **🗺️ 지도에서 찍기** → 지도에서 위치 클릭

## 테스트

```bash
npm test                       # 예산 계산·일정 정렬 단위 테스트
bash tests/e2e/run.sh          # 단위 + DB 권한(RLS) + 브라우저 E2E 전체
```

`tests/e2e/run.sh`는 로컬 Postgres(사용자 `postgres`, 비밀번호는 `PGPASSWORD`, 기본값 `postgres`)와 Playwright(Chromium)가 필요합니다.

- `tests/db/rls.test.mjs`: 실제 Postgres에 `schema.sql`을 적용하고 Supabase와 같은 역할(anon/authenticated, `auth.uid()`)로 권한을 검증
- `tests/e2e/mock-supabase.mjs`: supabase-js 요청을 실제 Postgres로 실행하는 **테스트 전용** 대역 서버 (실제 Supabase를 대신하지 않음)
- `tests/e2e/app.e2e.mjs`: 로컬 모드, 관리자 편집, 공유 링크 읽기 전용, 다른 계정 차단, 링크 비활성화, 반응형(375px~PC)

## 프로젝트 구조

```
gyeongju-trip/
├─ supabase/schema.sql        DB 테이블·RLS·함수
├─ src/
│  ├─ App.tsx                 라우팅 (로컬 / 관리자 로그인 / 공유 링크)
│  ├─ lib/
│  │  ├─ backend.ts           저장소 (LocalBackend / SupabaseBackend / 공유 조회)
│  │  ├─ useTrip.ts           상태 + 낙관적 업데이트 (실패 시 서버 데이터로 복구)
│  │  ├─ budget.ts            예산 계산
│  │  ├─ schedule.ts          일정 정렬·순서 변경·날짜 표시
│  │  └─ seed.ts              기본 여행 데이터
│  ├─ components/             헤더·하단 메뉴·공유 시트·로그인·공용 UI
│  └─ tabs/                   홈(지도·로드맵) / 예산 / 준비물
└─ tests/                     DB 권한 테스트, E2E
```
