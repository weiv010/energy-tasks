// 브라우저 E2E: 로컬 모드 + Supabase 모드(관리자/공유/권한)
// 실행: bash tests/e2e/run.sh
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
import { ANON_KEY } from './mock-supabase.mjs';

const LOCAL = process.env.LOCAL_URL ?? 'http://localhost:4173';
const APP = process.env.APP_URL ?? 'http://localhost:4174';
const API = 'http://localhost:54321';
const results = [];
let current = '';
const step = async (name, fn) => {
  current = name;
  try {
    await fn();
    results.push(`✅ ${name}`);
  } catch (e) {
    results.push(`❌ ${name}\n   ${e.message.split('\n')[0]}`);
    throw e;
  }
};

const browser = await chromium.launch();
const mobile = { ...devices['iPhone 13'], deviceScaleFactor: 1 };
const errors = [];
const watch = (p) => {
  p.setDefaultTimeout(8000);
  p.on('pageerror', (e) => errors.push(`${current}: ${e.message}${process.env.E2E_DEBUG ? '\n' + e.stack : ''}`));
  p.on('dialog', (d) => d.accept());
};

const money = async (p, id) => (await p.getByTestId(id).innerText()).trim();
const noHorizontalScroll = async (p) => {
  const [sw, w] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(sw <= w, `가로 스크롤 발생 scrollWidth=${sw} > ${w}`);
};

try {
  /* ─────────────── 로컬 미리보기 모드 ─────────────── */
  {
    const ctx = await browser.newContext({ ...mobile, acceptDownloads: true });
    const p = await ctx.newPage();
    watch(p);
    await step('[개인] 로그인 없이 바로 사용: 제목·날짜 표시, 공유 버튼 없음', async () => {
      await p.goto(LOCAL + '/');
      await p.getByRole('heading', { name: '장금이들의 경주 여행' }).waitFor();
      await p.getByText('2026.11.29 SUN - 11.30 MON').waitFor();
      assert.equal(await p.getByTestId('schedule-item').count(), 13);
      assert.equal(await p.getByText('관리자 로그인').count(), 0);
      assert.equal(await p.getByRole('button', { name: '🔗 여행 공유하기' }).count(), 0);
      assert.equal(await p.getByRole('button', { name: '👀 공유 화면 미리보기' }).count(), 0);
    });
    await step('[개인] 예산 체크 → 새로고침 후 유지', async () => {
      await p.getByRole('navigation').getByRole('button', { name: /예산/ }).click();
      await p.getByLabel('지베르니 호텔 지출 완료').check();
      assert.equal(await money(p, 'budget-spent'), '76,500원');
      await p.reload();
      assert.equal(await money(p, 'budget-remaining'), '223,500원');
    });
    await step('[개인] 백업 저장 → 초기화 → 백업 불러오기로 복원', async () => {
      await p.getByRole('button', { name: '💾 백업' }).click();
      const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: '⬇️ 백업 파일 저장' }).click()]);
      const path = await dl.path();
      const json = JSON.parse(await (await import('node:fs/promises')).readFile(path, 'utf8'));
      assert.equal(json.budget.find((b) => b.title === '지베르니 호텔').spent, true);
      await p.getByRole('button', { name: '처음 기본 일정으로 초기화' }).click();
      await p.waitForLoadState('load');
      await p.getByRole('navigation').getByRole('button', { name: /예산/ }).waitFor();
      await p.goto(LOCAL + '/#budget');
      assert.equal(await money(p, 'budget-spent'), '0원');
      await p.getByRole('button', { name: '💾 백업' }).click();
      await p.getByLabel('백업 파일 선택').setInputFiles(path);
      await p.getByTestId('budget-spent').waitFor();
      await p.waitForFunction(() => document.querySelector('[data-testid=budget-spent]')?.textContent?.includes('76,500'));
    });
    await step('[개인] 잘못된 백업 파일은 거부', async () => {
      await p.getByRole('button', { name: '💾 백업' }).click();
      await p.getByLabel('백업 파일 선택').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
      await p.getByText('여행 백업 파일 형식이 아니에요').waitFor();
      await p.getByRole('button', { name: '닫기' }).click();
      assert.equal(await money(p, 'budget-spent'), '76,500원');
    });
    await ctx.close();
  }

  /* ─────────────── Supabase 모드: 관리자 ─────────────── */
  const adminCtx = await browser.newContext(mobile);
  const admin = await adminCtx.newPage();
  watch(admin);
  await step('[관리자] 로그인 없이 접속하면 로그인 화면, 틀린 비밀번호 거부', async () => {
    await admin.goto(APP + '/');
    await admin.getByText('관리자 로그인').waitFor();
    await admin.getByLabel('이메일').fill('admin@test.local');
    await admin.getByLabel('비밀번호').fill('wrong');
    await admin.getByRole('button', { name: '로그인' }).click();
    await admin.getByText('이메일 또는 비밀번호가 올바르지 않아요').waitFor();
  });
  await step('[관리자] 로그인 → 기본 데이터가 서버에 생성되어 표시', async () => {
    await admin.getByLabel('비밀번호').fill('admin-pass-1234');
    await admin.getByRole('button', { name: '로그인' }).click();
    await admin.getByRole('heading', { name: '장금이들의 경주 여행' }).waitFor();
    await admin.getByTestId('schedule-item').first().waitFor();
    assert.equal(await admin.getByTestId('schedule-item').count(), 13);
    assert.equal(await admin.getByText('로컬 미리보기 모드').count(), 0);
    await admin.locator('.trip-marker').first().waitFor({ state: 'attached' });
    assert.equal(await admin.locator('.trip-marker').count(), 3, '좌표가 확인된 3곳만 지도에 표시');
  });
  await step('[관리자] 일정 추가 → 시간순 자동 정렬 → 새로고침 후 유지', async () => {
    await admin.getByRole('button', { name: '＋ 일정 추가' }).click();
    await admin.getByLabel('일정 제목 *').fill('황리단길 산책');
    await admin.getByLabel('시간 (정렬 기준)').fill('11:20');
    await admin.getByLabel('장소 또는 테마').fill('산책');
    await admin.getByLabel('상세 설명 (한 줄에 하나씩)').fill('소품샵 구경\n붕어빵');
    await admin.getByRole('button', { name: '저장' }).click();
    await admin.reload();
    await admin.getByTestId('schedule-item').first().waitFor();
    const titles = await admin.locator('[data-testid=schedule-item] h3').allInnerTexts();
    assert.equal(titles.length, 14);
    assert.equal(titles[3], '황리단길 산책', `순서: ${titles.slice(0, 5).join(', ')}`);
  });
  await step('[관리자] 일정 수정·순서 변경·완료 체크·삭제', async () => {
    const card = admin.getByTestId('schedule-item').filter({ hasText: '황리단길 산책' });
    await card.getByLabel('일정 수정').click();
    await admin.getByLabel('일정 제목 *').fill('황리단길 구경');
    await admin.getByRole('button', { name: '저장' }).click();
    const c2 = admin.getByTestId('schedule-item').filter({ hasText: '황리단길 구경' });
    await c2.getByLabel('아래로 이동').click(); // 11:40 꽃길 한복과 자리/시간 교환
    let titles = await admin.locator('[data-testid=schedule-item] h3').allInnerTexts();
    assert.equal(titles[4], '황리단길 구경');
    await admin.getByLabel('양산 출발 완료').check();
    await admin.reload();
    await admin.getByTestId('schedule-item').first().waitFor();
    titles = await admin.locator('[data-testid=schedule-item] h3').allInnerTexts();
    assert.equal(titles[4], '황리단길 구경', '순서 변경이 저장됨');
    assert.equal(await admin.getByLabel('양산 출발 완료').isChecked(), true);
    await admin.getByTestId('schedule-item').filter({ hasText: '황리단길 구경' }).getByLabel('일정 삭제').click();
    await admin.waitForTimeout(300);
    await admin.reload();
    await admin.getByTestId('schedule-item').first().waitFor();
    assert.equal(await admin.getByTestId('schedule-item').count(), 13);
  });
  await step('[관리자] 장소 좌표 입력 → 지도 마커 추가', async () => {
    await admin.getByRole('button', { name: '📍 장소 관리' }).click();
    await admin.getByLabel('올리브 카페 수정').click();
    await admin.getByLabel('위도 (lat)').fill('35.8370');
    await admin.getByLabel('경도 (lng)').fill('129.2100');
    await admin.getByRole('button', { name: '저장' }).click();
    await admin.getByRole('button', { name: '닫기' }).click();
    await admin.waitForTimeout(300);
    await admin.reload();
    await admin.locator('.trip-marker').first().waitFor({ state: 'attached' });
    assert.equal(await admin.locator('.trip-marker').count(), 4);
  });
  await step('[관리자] 예산: 체크한 항목만 사용 금액에 포함, 해제 시 복구', async () => {
    await admin.getByRole('navigation').getByRole('button', { name: /예산/ }).click();
    assert.equal(await money(admin, 'budget-total'), '300,000원');
    assert.equal(await money(admin, 'budget-planned'), '300,000원');
    assert.equal(await money(admin, 'budget-spent'), '0원');
    await admin.getByLabel('지베르니 호텔 지출 완료').check();
    assert.equal(await money(admin, 'budget-spent'), '76,500원');
    assert.equal(await money(admin, 'budget-remaining'), '223,500원');
    await admin.getByLabel('한복 자유이용권 2인 지출 완료').check();
    assert.equal(await money(admin, 'budget-remaining'), '157,500원');
    await admin.getByLabel('한복 자유이용권 2인 지출 완료').uncheck();
    assert.equal(await money(admin, 'budget-remaining'), '223,500원');
    await admin.getByLabel('댕기머리 손질 1인 지출 완료').check();
    assert.equal(await money(admin, 'budget-spent'), '83,500원', '선택 항목도 체크하면 사용 금액에 포함');
    await admin.getByLabel('댕기머리 손질 1인 지출 완료').uncheck();
    await admin.waitForTimeout(300);
    await admin.reload();
    assert.equal(await money(admin, 'budget-spent'), '76,500원', '새로고침 후에도 유지');
  });
  await step('[관리자] 예산 금액 수정·항목 추가/삭제·초과 경고', async () => {
    await admin.getByLabel('네컷 사진 수정').click();
    await admin.getByLabel('금액').fill('12,000');
    await admin.getByRole('button', { name: '저장' }).click();
    assert.equal(await money(admin, 'budget-planned'), '302,000원');
    await admin.getByText('전체 예산보다 2,000원 많아요').waitFor();
    await admin.getByRole('button', { name: '＋ 예산 항목 추가' }).click();
    await admin.getByLabel('항목 이름 *').fill('기념품');
    await admin.getByLabel('금액').fill('300000');
    await admin.getByRole('dialog').getByLabel('지출 완료', { exact: true }).check();
    await admin.getByRole('button', { name: '저장' }).click();
    assert.equal(await money(admin, 'budget-spent'), '376,500원');
    assert.equal(await money(admin, 'budget-remaining'), '-76,500원');
    await admin.getByText('예산을 76,500원 초과했어요!').waitFor();
    await admin.getByLabel('기념품 삭제').click();
    await admin.getByLabel('네컷 사진 수정').click();
    await admin.getByLabel('금액').fill('10000');
    await admin.getByRole('button', { name: '저장' }).click();
    await admin.waitForTimeout(300);
    await admin.reload();
    assert.equal(await money(admin, 'budget-planned'), '300,000원');
    assert.equal(await money(admin, 'budget-spent'), '76,500원');
    assert.equal(await admin.getByRole('alert').count(), 0);
  });
  await step('[관리자] 전체 예산 변경', async () => {
    await admin.getByLabel('전체 예산 수정').click();
    await admin.getByLabel('금액').fill('350000');
    await admin.getByRole('button', { name: '저장' }).click();
    assert.equal(await money(admin, 'budget-remaining'), '273,500원');
    await admin.getByLabel('전체 예산 수정').click();
    await admin.getByLabel('금액').fill('300000');
    await admin.getByRole('button', { name: '저장' }).click();
    await admin.waitForTimeout(300);
    await admin.reload();
    assert.equal(await money(admin, 'budget-total'), '300,000원');
  });
  await step('[관리자] 준비물: 체크·추가·이름 수정·삭제·카테고리 추가, 새로고침 유지', async () => {
    await admin.getByRole('navigation').getByRole('button', { name: /준비물/ }).click();
    assert.equal(await admin.getByTestId('checklist-count').innerText().then((t) => t.replace(/\s+/g, ' ')), '0 / 18');
    await admin.getByLabel('휴대폰 준비 완료').check();
    await admin.getByLabel('여행 필수품에 준비물 추가').fill('우산');
    await admin.getByLabel('여행 필수품에 준비물 추가').press('Enter');
    await admin.getByLabel('우산 이름 수정').click();
    await admin.getByLabel('준비물 이름').fill('접이식 우산');
    await admin.getByLabel('준비물 이름').press('Enter');
    await admin.getByLabel('핫팩 삭제').click();
    await admin.getByRole('button', { name: '＋ 카테고리 추가' }).click();
    await admin.getByLabel('카테고리 이름').fill('간식');
    await admin.getByRole('button', { name: '저장' }).click();
    await admin.getByLabel('간식에 준비물 추가').fill('귤');
    await admin.getByLabel('간식에 준비물 추가').press('Enter');
    await admin.waitForTimeout(400);
    await admin.reload();
    await admin.getByText('접이식 우산').waitFor();
    assert.equal(await admin.getByLabel('휴대폰 준비 완료').isChecked(), true);
    assert.equal(await admin.getByText('핫팩').count(), 0);
    assert.equal(await admin.getByTestId('checklist-category').count(), 5);
    assert.equal(await admin.getByTestId('checklist-count').innerText().then((t) => t.replace(/\s+/g, ' ')), '1 / 19');
    const done = admin.locator('span.line-through', { hasText: '휴대폰' });
    assert.equal(await done.count(), 1, '완료 항목 취소선');
  });

  let shareUrl;
  await step('[관리자] 여행 공유하기 → 고유 링크 생성·복사', async () => {
    await admin.getByRole('button', { name: '🔗 여행 공유하기' }).click();
    await admin.getByRole('button', { name: '✨ 새 공유 링크 만들기' }).click();
    await admin.getByTestId('share-url').first().waitFor();
    shareUrl = (await admin.getByTestId('share-url').first().innerText()).trim();
    assert.match(shareUrl, /^http:\/\/localhost:4174\/share\/[0-9a-f]{64}$/);
    await admin.getByRole('button', { name: '닫기' }).click();
  });

  /* ─────────────── 공유 사용자 ─────────────── */
  const guestCtx = await browser.newContext(mobile);
  const guest = await guestCtx.newPage();
  watch(guest);
  await step('[공유] 로그인 없이 지도·로드맵 보기, 편집 기능 없음', async () => {
    await guest.goto(shareUrl);
    await guest.getByRole('heading', { name: '장금이들의 경주 여행' }).waitFor();
    await guest.getByText('보기 전용').waitFor();
    await guest.getByTestId('schedule-item').first().waitFor();
    assert.equal(await guest.getByTestId('schedule-item').count(), 13);
    assert.equal(await guest.locator('.trip-marker').count(), 4);
    for (const name of ['＋ 일정 추가', '📍 장소 관리', '🔗 여행 공유하기', '로그아웃']) {
      assert.equal(await guest.getByRole('button', { name }).count(), 0, `${name} 버튼 숨김`);
    }
    assert.equal(await guest.getByLabel('일정 수정').count(), 0);
    assert.equal(await guest.getByLabel('일정 삭제').count(), 0);
    assert.equal(await guest.getByLabel('양산 출발 완료').isChecked(), true, '완료 현황은 보임');
    assert.equal(await guest.getByLabel('양산 출발 완료').isDisabled(), true, '체크박스 비활성화');
  });
  await step('[공유] 예산 현황 보기 전용', async () => {
    await guest.getByRole('navigation').getByRole('button', { name: /예산/ }).click();
    assert.equal(await money(guest, 'budget-spent'), '76,500원');
    assert.equal(await money(guest, 'budget-remaining'), '223,500원');
    const boxes = guest.locator('input[type=checkbox]');
    for (let i = 0; i < (await boxes.count()); i++) assert.equal(await boxes.nth(i).isDisabled(), true);
    assert.equal(await guest.getByRole('button', { name: /예산 항목 추가|전체 예산 수정/ }).count(), 0);
    await guest.getByLabel('예비비 지출 완료').click({ force: true });
    assert.equal(await money(guest, 'budget-spent'), '76,500원', '클릭해도 변경 안 됨');
  });
  await step('[공유] 준비물 체크 현황 보기 전용', async () => {
    await guest.getByRole('navigation').getByRole('button', { name: /준비물/ }).click();
    assert.equal(await guest.getByLabel('휴대폰 준비 완료').isChecked(), true);
    assert.equal(await guest.getByLabel('휴대폰 준비 완료').isDisabled(), true);
    assert.equal(await guest.getByRole('button', { name: '＋ 카테고리 추가' }).count(), 0);
    assert.equal(await guest.getByPlaceholder('준비물 추가').count(), 0);
  });
  await step('[공유] 공유 페이지에서 API 직접 호출로도 수정 불가 (서버 차단)', async () => {
    const r = await guest.evaluate(async ({ API, ANON_KEY }) => {
      const h = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
      const a = await fetch(`${API}/rest/v1/budget_items?select=*`, { headers: h });
      const b = await fetch(`${API}/rest/v1/budget_items?title=eq.예비비`, { method: 'PATCH', headers: h, body: JSON.stringify({ spent: true }) });
      const c = await fetch(`${API}/rest/v1/share_links?select=*`, { headers: h });
      return [a.status, b.status, c.status];
    }, { API, ANON_KEY });
    assert.deepEqual(r, [401, 401, 401]);
  });
  await step('[공유] 관리자가 수정하면 공유 화면에도 반영', async () => {
    await admin.getByRole('navigation').getByRole('button', { name: /준비물/ }).click();
    await admin.getByLabel('충전기 준비 완료').check();
    await admin.waitForTimeout(300);
    await guest.reload();
    await guest.getByLabel('충전기 준비 완료').waitFor();
    assert.equal(await guest.getByLabel('충전기 준비 완료').isChecked(), true);
  });
  await step('[공유] 공유 링크로는 관리자 화면 접근 불가', async () => {
    await guest.goto(APP + '/');
    await guest.getByText('관리자 로그인').waitFor();
  });
  await step('[권한] 다른 계정으로 로그인해도 관리자 여행은 보이지 않음', async () => {
    const ctx = await browser.newContext(mobile);
    const p = await ctx.newPage();
    watch(p);
    await p.goto(APP + '/');
    await p.getByLabel('이메일').fill('stranger@test.local');
    await p.getByLabel('비밀번호').fill('stranger-pass-1234');
    await p.getByRole('button', { name: '로그인' }).click();
    await p.getByTestId('schedule-item').first().waitFor();
    // 자기 자신의 새 기본 여행만 보인다 (관리자가 체크한 항목은 안 보임)
    assert.equal(await p.getByLabel('양산 출발 완료').isChecked(), false);
    await p.getByRole('navigation').getByRole('button', { name: /준비물/ }).click();
    assert.equal(await p.getByText('접이식 우산').count(), 0);
    await ctx.close();
  });
  await step('[관리자] 공유 링크 비활성화 → 공유 화면 접근 차단', async () => {
    await admin.getByRole('button', { name: '🔗 여행 공유하기' }).click();
    await admin.getByRole('button', { name: '비활성화' }).click();
    await admin.getByText('사용 중인 공유 링크가 없어요').waitFor();
    await admin.getByRole('button', { name: '닫기' }).click();
    await guest.goto(shareUrl);
    await guest.getByText('링크를 열 수 없어요').waitFor();
    await guest.goto(APP + '/share/not-a-real-token');
    await guest.getByText('링크를 열 수 없어요').waitFor();
  });
  await step('[관리자] 공유 화면 미리보기 토글', async () => {
    await admin.getByRole('button', { name: '👀 공유 화면 미리보기' }).click();
    await admin.getByText('공유 받은 사람에게 보이는 화면이에요').waitFor();
    assert.equal(await admin.getByLabel('휴대폰 준비 완료').isDisabled(), true);
    await admin.getByRole('button', { name: '편집으로 돌아가기' }).click();
    assert.equal(await admin.getByLabel('휴대폰 준비 완료').isDisabled(), false);
  });
  await step('[반응형] 375px·390px·태블릿·PC에서 가로 스크롤 없음', async () => {
    for (const vp of [{ width: 375, height: 700 }, { width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
      await admin.setViewportSize(vp);
      for (const t of [/홈/, /예산/, /준비물/]) {
        await admin.getByRole('navigation').getByRole('button', { name: t }).click();
        await admin.waitForTimeout(150);
        await noHorizontalScroll(admin);
      }
    }
  });
  await step('[관리자] 로그아웃 → 로그인 화면', async () => {
    await admin.getByRole('button', { name: '로그아웃' }).click();
    await admin.getByText('관리자 로그인').waitFor();
    await admin.reload();
    await admin.getByText('관리자 로그인').waitFor();
  });
  await step('브라우저 런타임 오류 없음', async () => {
    assert.deepEqual(errors, []);
  });
} finally {
  console.log(results.join('\n'));
  await browser.close();
}
