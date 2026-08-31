import { test, expect, type Page } from '@playwright/test';

const SHOT = 'docs/screenshots';

/** 온보딩을 API로 건너뛰고 localStorage에 계획을 심는다. */
async function seedPlan(page: Page) {
  await page.goto('/');
  const plan = await page.evaluate(async () => {
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: {
          startDate: '2026-08-31',
          endDate: '2026-09-27',
          daysPerWeek: 5,
          sessionMinutes: 40,
          concerns: ['forward_head', 'rounded_shoulder'],
          level: 2,
          equipment: ['band', 'foam_roller', 'ball', 'wall'],
          avoidTags: [],
          seed: 1234,
        },
      }),
    });
    const p = await res.json();
    localStorage.setItem('moccu.plan.v1', JSON.stringify(p));
    return p;
  });
  return plan as { sessions: Array<{ date: string; totalSec: number; blocks: Array<{ items: unknown[] }> }> };
}

test.describe('실행 화면', () => {
  test('캘린더 → 상세 → 실행: 타이머·일시정지·백그라운드 보정·중단 복원', async ({ page }) => {
    const plan = await seedPlan(page);
    const first = plan.sessions[0];

    // 홈: 오늘 루틴 카드
    await page.goto('/');
    await expect(page.getByText('오늘의 루틴')).toBeVisible();
    await shot(page, '06-home-with-plan');

    // 캘린더
    await page.getByRole('link', { name: '캘린더 열기' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByText(/진도율/).first()).toBeVisible();
    await shot(page, '07-calendar');

    // 상세
    await page.goto(`/plan/${first.date}`);
    await expect(page.getByRole('heading', { name: /1회차 · 1주차/ })).toBeVisible();
    await shot(page, '08-detail');

    // 실행 인트로: 면책 고지 필수 (SPEC 5.2)
    await page.getByRole('link', { name: '이 루틴 시작하기' }).click();
    await expect(page).toHaveURL(new RegExp(`/session/${first.date}$`));
    await expect(page.getByRole('note', { name: '의학적 면책 고지' })).toContainText('의학적 진단·치료가 아닙니다');
    await shot(page, '09-session-intro');

    // 시작 → 첫 스텝은 20초 전환(준비)
    await page.getByRole('button', { name: '운동 시작' }).click();
    await expect(page.getByText('다음 운동 준비')).toBeVisible();
    await expect(page.getByText(/예상 종료 \d{2}:\d{2}/)).toBeVisible();
    await shot(page, '10-session-running');

    // 백그라운드 보정: 시계를 90초 미래로 점프시켜 visibilitychange 발생
    await page.evaluate(() => {
      const realNow = Date.now;
      const offset = 90_000;
      // @ts-expect-error 테스트용 시계 조작
      Date.now = () => realNow() + offset;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // 20초 전환이 끝나고 work 스텝으로 넘어가 있어야 한다 (hold 카운트다운 또는 reps 버튼)
    await expect(page.getByText('다음 운동 준비')).toBeHidden({ timeout: 5_000 });
    await shot(page, '11-session-after-bg-jump');

    // 일시정지 → 재개
    await page.getByRole('button', { name: '일시정지' }).click();
    await expect(page.getByText('일시정지됨')).toBeVisible();
    await page.getByRole('button', { name: '재개' }).click();
    await expect(page.getByText('일시정지됨')).toBeHidden();

    // 중단 → 진행 상태 저장 → 상세로 이동
    await page.getByRole('button', { name: '중단', exact: true }).click();
    await page.getByRole('button', { name: '중단하기' }).click();
    await expect(page).toHaveURL(new RegExp(`/plan/${first.date}`));
    const saved = await page.evaluate((d) => localStorage.getItem(`moccu.progress.${d}`), first.date);
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).stepIndex).toBeGreaterThan(0);

    // 재진입 시 "이어서 하기"
    await expect(page.getByRole('link', { name: '이어서 하기' })).toBeVisible();
    await shot(page, '12-resume-available');
  });

  test('세트 완료·건너뛰기 → 세션 종료 → 완료 기록 저장', async ({ page }) => {
    const plan = await seedPlan(page);
    const first = plan.sessions[0];

    await page.goto(`/session/${first.date}`);
    await page.getByRole('button', { name: '운동 시작' }).click();

    // 빠르게 끝내기: 모든 운동을 건너뛴다 (상태 머신 종료 경로 검증)
    const skip = page.getByRole('button', { name: /이 운동 건너뛰기/ });
    for (let i = 0; i < 40; i++) {
      if (page.url().includes('/done')) break;
      try {
        await skip.click({ timeout: 2_000 });
      } catch {
        break;
      }
    }
    await expect(page).toHaveURL(new RegExp(`/session/${first.date}/done`), { timeout: 15_000 });

    // 완료 폼: RPE·통증·메모
    await expect(page.getByText('운동 끝!')).toBeVisible();
    await page.getByRole('radio', { name: '7', exact: true }).click();
    await page.getByRole('button', { name: /운동 중 통증이 있었나요/ }).click();
    await page.locator('textarea').fill('e2e 자동 기록');
    await shot(page, '13-done-form');
    await page.getByRole('button', { name: '완료 저장' }).click();

    // 기록 화면 + 진도율
    await expect(page.getByText('수고했습니다!')).toBeVisible();
    await expect(page.getByText(/진도율 · 1\/\d+회/)).toBeVisible();
    await shot(page, '14-done-record');

    // 저장 데이터 검증: status done, logs, painFlag
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('moccu.plan.v1')!));
    const s0 = stored.sessions.find((s: { date: string }) => s.date === first.date);
    expect(s0.status).toBe('done');
    expect(s0.logs.length).toBeGreaterThan(0);
    expect(s0.logs[0].rpe).toBe(7);
    expect(s0.logs.some((l: { painFlag: boolean }) => l.painFlag)).toBe(true);
    // 진행 상태 키는 정리됨
    const prog = await page.evaluate((d) => localStorage.getItem(`moccu.progress.${d}`), first.date);
    expect(prog).toBeNull();

    // 캘린더에 완료 표시
    await page.goto('/plan');
    await expect(page.getByText(/1\/\d+회 완료/)).toBeVisible();
    await shot(page, '15-calendar-after-done');
  });
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
}
