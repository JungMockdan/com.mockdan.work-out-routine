import { test, expect, type Page } from '@playwright/test';
import { stubYouTubeThumbs } from './ytimg';
import { readFileSync } from 'node:fs';
import { firstSessionISO, formatKo, shiftISO } from './dates';

/**
 * Supabase 모드 전 과정 검증 (SPEC 6 — "키 투입 후 1회 검증" 절차의 자동화).
 * localStorage 전제인 나머지 스위트와 배타적으로 돈다 — `E2E_SUPABASE=1` 일 때만 실행.
 *
 * 브라우저는 익명 로그인으로 사용자를 만들고, 검증은 service_role로 DB를 직접 읽어
 * "화면에서 한 일이 실제로 Supabase에 저장됐는지"를 확인한다.
 * 끝나면 만들어진 익명 사용자를 지운다(계획·세션·로그는 FK cascade로 함께 삭제).
 */

const SHOT = 'docs/screenshots';
const SUPABASE_MODE = process.env.E2E_SUPABASE === '1';

/** 테스트 프로세스에는 .env.local이 자동 주입되지 않으므로 직접 읽는다. */
function readEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = '';
  try {
    raw = readFileSync('.env.local', 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const ENV = readEnvLocal();
const URL_ = ENV.NEXT_PUBLIC_SUPABASE_URL;
const SRK = ENV.SUPABASE_SERVICE_ROLE_KEY;

/** service_role로 PostgREST 조회 (RLS 우회 — 검증 목적) */
async function db<T>(path: string): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: SRK, authorization: `Bearer ${SRK}` },
  });
  const body = (await res.json()) as T;
  if (!res.ok) throw new Error(`DB 조회 실패 ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function listUsers(): Promise<Array<{ id: string; email: string | null; is_anonymous: boolean }>> {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    headers: { apikey: SRK, authorization: `Bearer ${SRK}` },
  });
  const body = (await res.json()) as { users?: Array<{ id: string; email: string | null; is_anonymous: boolean }> };
  return body.users ?? [];
}

async function deleteUser(id: string): Promise<void> {
  await fetch(`${URL_}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SRK, authorization: `Bearer ${SRK}` },
  });
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
}

test.describe('Supabase 모드 — 온보딩부터 완료 기록까지', () => {
  test.skip(!SUPABASE_MODE, 'E2E_SUPABASE=1 일 때만 실행 (기본은 localStorage 모드 스위트)');

  // 유튜브 썸네일을 고정 이미지로 가로챈다 — 커밋되는 스크린샷의 결정성 유지 (e2e/ytimg.ts)
  test.beforeEach(async ({ page }) => {
    await stubYouTubeThumbs(page);
  });

  const created: string[] = [];

  test.beforeAll(() => {
    expect(URL_, '.env.local에 NEXT_PUBLIC_SUPABASE_URL이 필요합니다').toBeTruthy();
    expect(SRK, '.env.local에 SUPABASE_SERVICE_ROLE_KEY가 필요합니다').toBeTruthy();
  });

  test.afterAll(async () => {
    // 이 테스트가 만든 익명 사용자 정리 (plans/sessions/session_logs는 cascade)
    for (const id of created) await deleteUser(id);
  });

  test('계획 생성·실행·완료가 전부 Supabase에 저장된다', async ({ page }) => {
    const before = new Set((await listUsers()).map((u) => u.id));

    // ── 온보딩 ──────────────────────────────────────────────
    await page.goto('/');
    await page.getByRole('link', { name: '시작하기' }).click();
    await expect(page).toHaveURL(/\/onboarding\/concerns/);
    await page.getByRole('button', { name: /거북목/ }).first().click();
    await page.getByRole('button', { name: /굽은 어깨/ }).first().click();
    await page.getByRole('button', { name: '굽은 어깨 위로' }).click();
    await page.getByRole('button', { name: /다음/ }).click();

    await expect(page).toHaveURL(/\/onboarding\/profile/);
    await page.getByRole('group', { name: '레벨' }).getByRole('button', { name: /중급/ }).click();
    await page.getByRole('button', { name: '밴드', exact: true }).click();
    await page.getByRole('button', { name: /무릎 통증/ }).click();
    await page.getByRole('button', { name: '다음' }).click();

    await expect(page).toHaveURL(/\/onboarding\/schedule/);
    const startInput = page.getByLabel('시작일');
    const start = await startInput.getAttribute('min');
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await startInput.fill(start!);
    await page.getByRole('button', { name: '4주' }).click();
    await expect(page.getByLabel('종료일')).toHaveValue(shiftISO(start!, 27));
    await page.getByRole('button', { name: /주 4회/ }).click();
    await page.getByRole('button', { name: '루틴 생성하기' }).click();

    // ── 미리보기 (엔진은 서버에서 실행) ──────────────────────
    await expect(page).toHaveURL(/\/onboarding\/preview/);
    await expect(page.getByText('루틴이 준비됐습니다')).toBeVisible({ timeout: 30_000 });
    const firstDate = firstSessionISO(start!, 4);
    await expect(page.getByText(`첫 세션 · ${formatKo(firstDate, false)}`)).toBeVisible();
    await expect(page.getByRole('note', { name: '의학적 면책 고지' })).toContainText('의학적 진단·치료가 아닙니다');
    await page.getByRole('button', { name: '이 계획 시작하기' }).click();
    await expect(page).toHaveURL(/\/plan/, { timeout: 30_000 });
    await shot(page, '16-supabase-plan');

    // ── 익명 사용자가 만들어졌다 ────────────────────────────
    const after = await listUsers();
    const fresh = after.filter((u) => !before.has(u.id));
    created.push(...fresh.map((u) => u.id));
    expect(fresh.length, '익명 사용자가 1명 생성되어야 한다').toBe(1);
    const userId = fresh[0].id;
    expect(fresh[0].is_anonymous, '익명 사용자여야 한다').toBe(true);

    // localStorage 모드가 아님을 확인 — 계획이 로컬에 저장되지 않았다
    const local = await page.evaluate(() => localStorage.getItem('moccu.plan.v1'));
    expect(local, 'Supabase 모드에서는 계획이 localStorage에 저장되지 않는다').toBeNull();

    // ── DB 검증: plans / sessions ───────────────────────────
    const plans = await db<Array<{ id: string; status: string; concerns: string[]; level: number; avoid_tags: string[]; seed: number }>>(
      `plans?user_id=eq.${userId}&select=id,status,concerns,level,avoid_tags,seed`,
    );
    expect(plans.length).toBe(1);
    expect(plans[0].status).toBe('active');
    // 목표 배열 순서 = 우선순위 (화면에서 '굽은 어깨'를 1순위로 올렸다)
    expect(plans[0].concerns).toEqual(['rounded_shoulder', 'forward_head']);
    expect(plans[0].level).toBe(2);
    expect(plans[0].avoid_tags).toEqual(['knee_pain']);
    const planId = plans[0].id;

    const sessions = await db<Array<{ id: string; date: string; status: string; total_sec: number; blocks: Array<{ items: Array<{ exercise: { contraindications?: string[] } }> }> }>>(
      `sessions?plan_id=eq.${planId}&select=id,date,status,total_sec,blocks&order=date`,
    );
    expect(sessions.length, '4주 · 주4회 → 16세션').toBe(16);
    expect(sessions[0].date).toBe(firstDate);
    for (const s of sessions) {
      expect(Math.abs(s.total_sec - 2400), `세션 ${s.date} 40분 ±2분`).toBeLessThanOrEqual(120);
      expect(s.blocks.length, 'blocks 스냅샷 5페이즈').toBe(5);
      for (const b of s.blocks) {
        for (const it of b.items) {
          expect(it.exercise.contraindications ?? []).not.toContain('knee_pain');
        }
      }
    }

    // profiles도 저장됐다
    const profiles = await db<Array<{ id: string; level: number; avoid_tags: string[] }>>(
      `profiles?id=eq.${userId}&select=id,level,avoid_tags`,
    );
    expect(profiles.length).toBe(1);
    expect(profiles[0].avoid_tags).toEqual(['knee_pain']);

    // ── 실행 화면 ───────────────────────────────────────────
    await page.goto(`/plan/${firstDate}`);
    await expect(page.getByRole('heading', { name: /1회차 · 1주차/ })).toBeVisible();
    await page.getByRole('link', { name: '이 루틴 시작하기' }).click();
    await expect(page).toHaveURL(new RegExp(`/session/${firstDate}$`));
    await expect(page.getByRole('note', { name: '의학적 면책 고지' })).toContainText('의학적 진단·치료가 아닙니다');
    await page.getByRole('button', { name: '운동 시작' }).click();

    // 전부 건너뛰어 종료 경로로 간다
    const skip = page.getByRole('button', { name: /이 운동 건너뛰기/ });
    for (let i = 0; i < 40; i++) {
      if (page.url().includes('/done')) break;
      try {
        await skip.click({ timeout: 2_000 });
      } catch {
        break;
      }
    }
    await expect(page).toHaveURL(new RegExp(`/session/${firstDate}/done`), { timeout: 15_000 });

    // ── 완료 기록 ───────────────────────────────────────────
    await page.getByRole('group', { name: '자각 강도' }).getByRole('button', { name: '7', exact: true }).click();
    await page.getByRole('button', { name: /운동 중 통증이 있었나요/ }).click();
    await page.locator('textarea').fill('supabase e2e');
    await page.getByRole('button', { name: '완료 저장' }).click();
    await expect(page.getByText('수고했습니다!')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/진도율 · 1\/\d+회/)).toBeVisible();
    await shot(page, '17-supabase-done');

    // ── DB 검증: 완료 상태 · 실측 시간 · 로그 ───────────────
    const doneRows = await db<Array<{ id: string; status: string; elapsed_sec: number | null; completed_at: string | null }>>(
      `sessions?plan_id=eq.${planId}&date=eq.${firstDate}&select=id,status,elapsed_sec,completed_at`,
    );
    expect(doneRows.length).toBe(1);
    expect(doneRows[0].status, '세션이 done으로 저장').toBe('done');
    expect(doneRows[0].completed_at, 'completed_at 기록').toBeTruthy();
    expect(doneRows[0].elapsed_sec, 'elapsed_sec 기록(실측 소요 시간)').not.toBeNull();

    const logs = await db<Array<{ rpe: number | null; pain_flag: boolean; note: string | null; exercise_id: string }>>(
      `session_logs?session_id=eq.${doneRows[0].id}&select=rpe,pain_flag,note,exercise_id`,
    );
    expect(logs.length, 'session_logs가 기록된다').toBeGreaterThan(0);
    expect(logs.every((l) => l.rpe === 7), 'RPE 7 기록').toBe(true);
    expect(logs.some((l) => l.pain_flag), '통증 신고 기록').toBe(true);
    expect(logs.some((l) => l.note === 'supabase e2e'), '메모 기록').toBe(true);

    // ── 캘린더에 완료가 반영된다 (Supabase에서 다시 읽어온 값) ──
    await page.goto('/plan');
    await expect(page.getByText(/1\/\d+회 완료/)).toBeVisible();
    await shot(page, '18-supabase-calendar');
  });
});
