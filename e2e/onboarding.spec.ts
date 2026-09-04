import { test, expect, type Page } from '@playwright/test';
import { firstSessionISO, formatKo, shiftISO } from './dates';

const SHOT = 'docs/screenshots';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
}

test.describe('온보딩 → 미리보기', () => {
  // localStorage 저장소를 직접 단정하는 스위트 — Supabase 모드에서는 supabase.spec.ts가 대신 돈다
  test.skip(process.env.E2E_SUPABASE === '1', 'localStorage 모드 전용');

  test('목표 선택·우선순위·프로필·기간 → buildPlan 결과 렌더링', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: '시작하기' })).toBeVisible();
    await shot(page, '01-home-empty');

    // 1) 목표 선택 (순서 = 우선순위)
    await page.getByRole('link', { name: '시작하기' }).click();
    await expect(page).toHaveURL(/\/onboarding\/concerns/);
    await page.getByRole('button', { name: /거북목/ }).first().click();
    await page.getByRole('button', { name: /굽은 어깨/ }).first().click();
    await page.getByRole('button', { name: /불안한 고관절/ }).first().click();
    await expect(page.getByRole('button', { name: /다음 \(3개 선택\)/ })).toBeEnabled();

    // 우선순위 변경: 굽은 어깨를 위로 → 1순위
    await page.getByRole('button', { name: '굽은 어깨 위로' }).click();
    const list = page.getByRole('list', { name: '우선순위 목록' });
    await expect(list.locator('li').nth(0)).toContainText('굽은 어깨');
    await expect(list.locator('li').nth(1)).toContainText('거북목');
    await shot(page, '02-concerns');
    await page.getByRole('button', { name: /다음/ }).click();

    // 2) 레벨 · 장비 · 통증
    await expect(page).toHaveURL(/\/onboarding\/profile/);
    await page.getByRole('group', { name: '레벨' }).getByRole('button', { name: /중급/ }).click();
    await page.getByRole('button', { name: '밴드', exact: true }).click();
    await page.getByRole('button', { name: '폼롤러', exact: true }).click();
    await page.getByRole('button', { name: /무릎 통증/ }).click();
    await shot(page, '03-profile');
    await page.getByRole('button', { name: '다음' }).click();

    // 3) 기간
    await expect(page).toHaveURL(/\/onboarding\/schedule/);
    // 과거 시작일은 오늘로 클램프되므로 고정 날짜를 쓰지 않는다.
    // min 속성 = 앱이 계산한 오늘. 이걸 기준으로 상대 검증한다.
    const startInput = page.getByLabel('시작일');
    const start = await startInput.getAttribute('min');
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await startInput.fill(start!);
    await page.getByRole('button', { name: '4주' }).click();
    await expect(page.getByLabel('종료일')).toHaveValue(shiftISO(start!, 27));
    await page.getByRole('button', { name: /주 4회/ }).click();
    await expect(page.getByText('16회')).toBeVisible();
    await shot(page, '04-schedule');
    await page.getByRole('button', { name: '루틴 생성하기' }).click();

    // 4) 미리보기 — 엔진 결과 렌더링
    await expect(page).toHaveURL(/\/onboarding\/preview/);
    await expect(page.getByText('루틴이 준비됐습니다')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1. 굽은 어깨')).toBeVisible();
    await expect(page.getByText('2. 거북목')).toBeVisible();
    const firstDate = firstSessionISO(start!, 4);
    await expect(page.getByText(`첫 세션 · ${formatKo(firstDate, false)}`)).toBeVisible();
    // 5개 페이즈 아코디언
    for (const label of ['이완 · 근막 릴리즈', '가동성', '활성화', '강화', '통합 · 정리']) {
      await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }
    // 면책 고지 (SPEC 5.2)
    await expect(page.getByRole('note', { name: '의학적 면책 고지' })).toContainText('의학적 진단·치료가 아닙니다');
    // 40분 ±2분: "총 N분" 표시 파싱
    const summary = await page.getByText(/총\s*\d+분/).first().textContent();
    const m = summary?.match(/총\s*(\d+)분(?:\s*(\d+)초)?/);
    expect(m).not.toBeNull();
    const totalSec = Number(m![1]) * 60 + Number(m![2] ?? 0);
    expect(Math.abs(totalSec - 2400)).toBeLessThanOrEqual(120);
    await shot(page, '05-preview');

    // 5) 시작 → 캘린더로 이동, 홈에 계획이 보임
    await page.getByRole('button', { name: '이 계획 시작하기' }).click();
    await expect(page).toHaveURL(/\/plan/, { timeout: 30_000 });
    const stored = await page.evaluate(() => localStorage.getItem('moccu.plan.v1'));
    expect(stored).not.toBeNull();
    const plan = JSON.parse(stored!);
    expect(plan.sessions.length).toBe(16);
    expect(plan.sessions[0].date).toBe(firstDate);
    expect(plan.input.startDate).toBe(start);
    expect(plan.input.concerns).toEqual(['rounded_shoulder', 'forward_head', 'hip_instability']);
    expect(plan.input.avoidTags).toEqual(['knee_pain']);
    // 스냅샷: blocks가 저장되어 있다
    expect(plan.sessions[0].blocks.length).toBe(5);
    // 금기 운동이 한 번도 없다
    for (const s of plan.sessions) {
      for (const b of s.blocks) {
        for (const it of b.items) {
          expect(it.exercise.contraindications ?? []).not.toContain('knee_pain');
        }
      }
      expect(Math.abs(s.totalSec - 2400)).toBeLessThanOrEqual(120);
    }
  });
});
