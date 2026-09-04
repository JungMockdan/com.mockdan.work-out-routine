import { test, expect, type Page } from '@playwright/test';
import { stubYouTubeThumbs } from './ytimg';
import { EXERCISE_VIDEOS, exerciseVideos, isReviewed } from '../src/data/exercise-media';

/**
 * 시연 영상 UI 검증 — 루틴 상세(/plan/[date])의 운동 카드.
 *
 * ⚠️ iframe 내부 재생은 단정하지 않는다.
 *    ① 외부 서비스라 e2e가 검증할 대상이 아니고
 *    ② Playwright 번들 Chromium에는 H.264 등 독점 코덱이 없어 어차피 재생되지 않는다.
 *    실기기 재생 확인은 사람이 한다 (특히 라이트박스를 닫은 뒤 소리가 멈추는지).
 *
 * 썸네일은 e2e/ytimg.ts로 가로챈다 — 네트워크 의존과 스크린샷 흔들림 제거.
 */

/** 검수를 통과한 영상이 있는 운동 id */
const REVIEWED_EX_IDS = Object.keys(EXERCISE_VIDEOS).filter((id) => EXERCISE_VIDEOS[id].some(isReviewed));

/** 후보는 있지만 하나도 검수를 통과하지 못한 운동 id */
const UNREVIEWED_EX_IDS = Object.keys(EXERCISE_VIDEOS).filter(
  (id) => EXERCISE_VIDEOS[id].length > 0 && EXERCISE_VIDEOS[id].every((v) => !isReviewed(v)),
);

type SeededPlan = {
  sessions: Array<{ date: string; blocks: Array<{ items: Array<{ exercise: { id: string; nameKo: string } }> }> }>;
};
type Target = { date: string; id: string; nameKo: string };

/** 온보딩을 건너뛰고 localStorage에 계획을 심는다 (session.spec.ts와 같은 방식, 상대 날짜). */
async function seedPlan(page: Page): Promise<SeededPlan> {
  await page.goto('/');
  const plan = await page.evaluate(async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 27);
    const res = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: {
          startDate: isoOf(now),
          endDate: isoOf(end),
          daysPerWeek: 5,
          sessionMinutes: 40,
          concerns: ['forward_head', 'rounded_shoulder', 'hip_instability', 'pelvic_tilt', 'major_muscle'],
          level: 2,
          equipment: ['band', 'foam_roller', 'ball', 'wall', 'dumbbell', 'bench', 'mat', 'lat_pulldown', 'cable'],
          avoidTags: [],
          seed: 4321,
        },
      }),
    });
    const p = await res.json();
    localStorage.setItem('moccu.plan.v1', JSON.stringify(p));
    return p;
  });
  return plan as SeededPlan;
}

/** 운동명에 괄호가 들어간다 (예: '친 턱 (심부 목굴곡근 활성)') — 정규식으로 쓰기 전에 이스케이프한다. */
function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 해당 운동의 시연 영상 재생 버튼 */
function playButton(page: Page, nameKo: string) {
  return page.getByRole('button', { name: new RegExp(`${reEscape(nameKo)} 시연 영상 재생`) });
}

/** 계획 안에서 주어진 id 집합에 속한 첫 운동을 찾는다. 엔진이 뭘 뽑을지 고정할 수 없으므로 탐색한다. */
function findInPlan(plan: SeededPlan, ids: string[]): Target | null {
  const want = new Set(ids);
  for (const s of plan.sessions) {
    for (const b of s.blocks) {
      for (const it of b.items) {
        if (want.has(it.exercise.id)) return { date: s.date, id: it.exercise.id, nameKo: it.exercise.nameKo };
      }
    }
  }
  return null;
}

test.describe('시연 영상 — 검수 게이트', () => {
  test.skip(process.env.E2E_SUPABASE === '1', 'localStorage 모드 전용');
  test.skip(UNREVIEWED_EX_IDS.length === 0, '검수 대기 중인 후보가 없다');

  test.beforeEach(async ({ page }) => {
    await stubYouTubeThumbs(page);
  });

  test('검수를 통과하지 않은 후보는 화면에 전혀 나오지 않는다', async ({ page }) => {
    const plan = await seedPlan(page);
    const target = findInPlan(plan, UNREVIEWED_EX_IDS);
    test.skip(target === null, '검수 대기 후보를 가진 운동이 이 계획에 배정되지 않았다');
    const t = target!;

    // resolver 레벨에서 이미 걸러진다
    expect(exerciseVideos(t.id)).toHaveLength(0);

    await page.goto(`/plan/${t.date}`);
    // 운동 카드 자체는 렌더된다 (게이트가 카드를 지우는 게 아니라 영상만 감추는지 확인)
    await expect(page.getByText(t.nameKo).first()).toBeVisible();

    // 이 운동에는 재생 버튼이 없다.
    // 같은 세션에 검수 완료된 다른 운동이 있을 수 있으므로 페이지 전역이 아니라 이 운동으로 좁혀 단정한다.
    await expect(playButton(page, t.nameKo)).toHaveCount(0);

    // 후보의 videoId·썸네일이 페이지 어디에도 새지 않는다
    const html = await page.content();
    for (const v of EXERCISE_VIDEOS[t.id]) {
      expect(html).not.toContain(v.videoId);
      await expect(page.locator(`img[src*="${v.videoId}"]`)).toHaveCount(0);
    }

    // 아무것도 열지 않았으므로 iframe은 전역으로도 없다
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});

test.describe('시연 영상 — 재생 UI', () => {
  test.skip(process.env.E2E_SUPABASE === '1', 'localStorage 모드 전용');
  test.skip(
    REVIEWED_EX_IDS.length === 0,
    '검수 완료된 영상이 아직 없다 — 커버리지는 npm run verify:media 로 확인',
  );

  test.beforeEach(async ({ page }) => {
    await stubYouTubeThumbs(page);
  });

  test('루틴 상세에서 썸네일 → 라이트박스 → 닫으면 iframe이 사라진다', async ({ page }) => {
    const plan = await seedPlan(page);
    const target = findInPlan(plan, REVIEWED_EX_IDS);
    test.skip(target === null, '검수 완료 영상을 가진 운동이 이 계획에 배정되지 않았다');
    const t = target!;

    const videos = exerciseVideos(t.id);
    expect(videos.length).toBeGreaterThan(0);
    const v = videos[0];

    await page.goto(`/plan/${t.date}`);

    const playBtn = playButton(page, t.nameKo).first();
    await expect(playBtn).toBeVisible();

    // 썸네일 (i.ytimg 스텁으로 가로챈다)
    const thumb = playBtn.locator('img');
    await expect(thumb).toHaveAttribute('src', v.thumb);
    await expect(thumb).toHaveAttribute('loading', 'lazy');
    // 장식용 이미지 — 접근성 이름은 버튼이 가진다
    await expect(thumb).toHaveAttribute('alt', '');

    // 출처(채널명) 표시 — 저작권상 의무
    await expect(playBtn).toContainText(v.channel);

    // 열기 전에는 iframe이 DOM에 없다
    await expect(page.locator('iframe')).toHaveCount(0);

    await playBtn.click();

    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    await expect(dialog.locator('iframe')).toHaveAttribute('src', v.embedUrl);
    expect(v.embedUrl).toContain('youtube-nocookie.com/embed/');

    // 임베드 차단 영상을 위한 탈출구가 항상 있다
    const out = dialog.getByRole('link', { name: /유튜브에서 열기/ });
    await expect(out).toHaveAttribute('href', v.watchUrl);
    await expect(out).toHaveAttribute('target', '_blank');
    await expect(out).toHaveAttribute('rel', /noopener/);

    // Escape로 닫히고, iframe이 DOM에서 사라진다 (남으면 오디오가 계속 재생된다)
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);

    // 닫기 버튼으로도 같아야 한다
    await playBtn.click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.getByRole('button', { name: '영상 닫기' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});
