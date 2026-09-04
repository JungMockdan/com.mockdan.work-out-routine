/**
 * 시연 영상 매니페스트 검증.  실행:  npm run verify:media
 *                          링크 생존까지:  npm run verify:media -- --check-links
 *
 * 검증 항목
 *  1. 매니페스트 키가 실제 운동 id인가
 *  2. Exercise.mediaRef가 전부 null인가 (스냅샷에 영상이 새어 들어가지 않게 하는 트립와이어)
 *  3. videoId 형식 / 운동 내 중복 / title·channel 기입
 *  4. 검수 표기가 온전한가 (reviewedAt ⇔ reviewedBy ∈ REVIEWERS, 유효 날짜, 미래 아님)
 *  5. **미검수 항목이 resolver 출력에서 실제로 빠지는가** — 데이터를 눈으로 보지 않고 exerciseVideos()를 돌린다
 *  6. (--check-links) 유튜브 oEmbed로 영상이 살아있는가
 */
import { EXERCISES, EXERCISE_BY_ID } from '../src/data/exercises.ts';
import {
  EXERCISE_VIDEOS,
  REVIEWERS,
  exerciseVideos,
  isReviewed,
  type VideoEntry,
} from '../src/data/exercise-media.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  console.log('  [' + mark + '] ' + name + (detail ? ' — ' + detail : ''));
}

const warnings: string[] = [];
function warn(msg: string): void {
  warnings.push(msg);
}

const ids = Object.keys(EXERCISE_VIDEOS);
const allEntries: Array<{ exId: string; v: VideoEntry }> = [];
for (const exId of ids) for (const v of EXERCISE_VIDEOS[exId]) allEntries.push({ exId, v });

/* ─────────── 1. 매니페스트 키 ─────────── */
console.log('\n[1] 매니페스트 키');
const unknownIds = ids.filter((id) => !EXERCISE_BY_ID[id]);
check('모든 키가 실제 운동 id', unknownIds.length === 0, unknownIds.join(', ') || ids.length + '개 확인');
const emptyLists = ids.filter((id) => EXERCISE_VIDEOS[id].length === 0);
check('빈 배열인 키 없음', emptyLists.length === 0, emptyLists.join(', ') || '없음');

/* ─────────── 2. mediaRef 트립와이어 ─────────── */
console.log('\n[2] mediaRef 트립와이어');
const withMediaRef = EXERCISES.filter((e) => e.mediaRef != null).map((e) => e.id);
check(
  'Exercise.mediaRef가 전부 null (영상은 매니페스트에만)',
  withMediaRef.length === 0,
  withMediaRef.length ? withMediaRef.join(', ') : EXERCISES.length + '종 전부 null',
);

/* ─────────── 3. videoId 형식·중복 ─────────── */
console.log('\n[3] videoId');
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const badIds = allEntries.filter((x) => !ID_RE.test(x.v.videoId)).map((x) => x.exId + ':' + x.v.videoId);
check('videoId 형식 (11자)', badIds.length === 0, badIds.join(', ') || allEntries.length + '건 확인');

const dupes: string[] = [];
for (const exId of ids) {
  const seen = new Set<string>();
  for (const v of EXERCISE_VIDEOS[exId]) {
    if (seen.has(v.videoId)) dupes.push(exId + ':' + v.videoId);
    seen.add(v.videoId);
  }
}
check('운동 내 videoId 중복 없음', dupes.length === 0, dupes.join(', ') || '없음');

const missingMeta = allEntries
  .filter((x) => !x.v.title || !x.v.title.trim() || !x.v.channel || !x.v.channel.trim())
  .map((x) => x.exId + ':' + x.v.videoId);
check('title·channel 기입됨 (출처 표시 의무)', missingMeta.length === 0, missingMeta.join(', ') || '없음');

const badStart = allEntries
  .filter((x) => x.v.startSec != null && (!Number.isInteger(x.v.startSec) || x.v.startSec < 0))
  .map((x) => x.exId + ':' + x.v.videoId);
check('startSec는 0 이상 정수', badStart.length === 0, badStart.join(', ') || '해당 없음');

/* ─────────── 4. 검수 표기 ─────────── */
console.log('\n[4] 검수 표기');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayISO = new Date().toISOString().slice(0, 10);
const badReview: string[] = [];
for (const x of allEntries) {
  const tag = x.exId + ':' + x.v.videoId;
  const hasAt = Boolean(x.v.reviewedAt);
  const hasBy = Boolean(x.v.reviewedBy);
  if (hasAt !== hasBy) badReview.push(tag + '(reviewedAt/By 한쪽만)');
  if (hasBy && !(REVIEWERS as readonly string[]).includes(x.v.reviewedBy as string)) {
    badReview.push(tag + '(REVIEWERS에 없는 검수자 ' + x.v.reviewedBy + ')');
  }
  if (hasAt) {
    const at = x.v.reviewedAt as string;
    if (!DATE_RE.test(at) || Number.isNaN(Date.parse(at))) badReview.push(tag + '(날짜 형식 ' + at + ')');
    else if (at > todayISO) badReview.push(tag + '(미래 날짜 ' + at + ')');
  }
}
check('검수 표기 온전', badReview.length === 0, badReview.join(', ') || '오늘 ' + todayISO + ' 기준');

/* ─────────── 5. 게이트 — resolver를 실제로 돌린다 ─────────── */
console.log('\n[5] 게이트 (exerciseVideos 실행)');
const unreviewedIds = new Set(allEntries.filter((x) => !isReviewed(x.v)).map((x) => x.v.videoId));
const leaked: string[] = [];
let resolvedTotal = 0;
for (const exId of ids) {
  const out = exerciseVideos(exId);
  resolvedTotal += out.length;
  for (const r of out) if (unreviewedIds.has(r.videoId)) leaked.push(exId + ':' + r.videoId);
  const expected = EXERCISE_VIDEOS[exId].filter(isReviewed).length;
  if (out.length !== expected) leaked.push(exId + '(개수 ' + out.length + '≠' + expected + ')');
}
check(
  '미검수 영상이 resolver 출력에 없음',
  leaked.length === 0,
  leaked.join(', ') || '미검수 ' + unreviewedIds.size + '건 차단 · 노출 ' + resolvedTotal + '건',
);
check('없는 운동 id는 빈 배열', exerciseVideos('__nope__').length === 0);

const badUrls = ids
  .flatMap((id) => exerciseVideos(id))
  .filter(
    (r) =>
      !r.embedUrl.startsWith('https://www.youtube-nocookie.com/embed/') ||
      !r.thumb.startsWith('https://i.ytimg.com/vi/'),
  )
  .map((r) => r.videoId);
check('임베드는 youtube-nocookie, 썸네일은 i.ytimg', badUrls.length === 0, badUrls.join(', ') || '확인');

/* ─────────── 6. 링크 생존 (--check-links) ─────────── */
const CHECK_LINKS = process.argv.includes('--check-links');
if (CHECK_LINKS) {
  console.log('\n[6] 링크 생존 (유튜브 oEmbed)');

  const oembed = async (videoId: string): Promise<{ status: number; title?: string; author?: string }> => {
    const url =
      'https://www.youtube.com/oembed?url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + videoId) +
      '&format=json';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url);
        if (res.status === 200) {
          const j = (await res.json()) as { title?: string; author_name?: string };
          return { status: 200, title: j.title, author: j.author_name };
        }
        return { status: res.status };
      } catch {
        if (attempt === 1) return { status: 0 };
      }
    }
    return { status: 0 };
  };

  const dead: string[] = [];
  for (const x of allEntries) {
    const r = await oembed(x.v.videoId);
    const tag = x.exId + ':' + x.v.videoId;
    if (r.status === 200) {
      // 제목·채널 변경은 흔하다 — 실패가 아니라 경고
      if (r.title && x.v.title && r.title !== x.v.title) {
        warn(tag + ' 제목 변경: "' + x.v.title + '" → "' + r.title + '"');
      }
      if (r.author && x.v.channel && r.author !== x.v.channel) {
        warn(tag + ' 채널 변경: "' + x.v.channel + '" → "' + r.author + '"');
      }
    } else {
      const why =
        r.status === 401 || r.status === 403 ? '임베드 차단·접근 제한'
        : r.status === 404 ? '삭제·비공개'
        : r.status === 400 ? '잘못된 ID'
        : r.status === 0 ? '네트워크 실패'
        : 'HTTP ' + r.status;
      dead.push(tag + '(' + why + ')');
    }
    await new Promise((res) => setTimeout(res, 200));
  }
  check('모든 영상이 살아있고 임베드 가능', dead.length === 0, dead.join(', ') || allEntries.length + '건 확인');
} else {
  console.log('\n[6] 링크 생존 — 건너뜀 (--check-links 로 켠다)');
}

/* ─────────── 커버리지 보고 (실패 아님) ─────────── */
console.log('\n[보고] 커버리지');
const reviewedByEx = new Map<string, number>();
const candidateByEx = new Map<string, number>();
for (const exId of ids) {
  reviewedByEx.set(exId, EXERCISE_VIDEOS[exId].filter(isReviewed).length);
  candidateByEx.set(exId, EXERCISE_VIDEOS[exId].filter((v) => !isReviewed(v)).length);
}
const withReviewed = [...reviewedByEx.values()].filter((n) => n > 0).length;
const withCandidateOnly = ids.filter(
  (id) => (reviewedByEx.get(id) ?? 0) === 0 && (candidateByEx.get(id) ?? 0) > 0,
).length;
const noneAtAll = EXERCISES.filter((e) => !EXERCISE_VIDEOS[e.id] || EXERCISE_VIDEOS[e.id].length === 0);

console.log('      검수 완료: ' + withReviewed + '/' + EXERCISES.length + ' 종');
console.log('      후보만 있음(검수 대기): ' + withCandidateOnly + ' 종');
console.log('      영상 0개: ' + noneAtAll.length + ' 종');

const byPhase: Record<string, { done: number; total: number }> = {};
for (const e of EXERCISES) {
  byPhase[e.phase] ??= { done: 0, total: 0 };
  byPhase[e.phase].total += 1;
  if ((reviewedByEx.get(e.id) ?? 0) > 0) byPhase[e.phase].done += 1;
}
for (const [phase, n] of Object.entries(byPhase)) {
  console.log('        ' + phase.padEnd(12) + ' ' + n.done + '/' + n.total);
}

const ko = allEntries.filter((x) => x.v.lang === 'ko').length;
console.log('      언어: ko ' + ko + ' · en ' + (allEntries.length - ko) + ' (총 ' + allEntries.length + '건)');

if (warnings.length) {
  console.log('\n[경고]');
  for (const w of warnings) console.log('  ! ' + w);
}

console.log('\n' + (failures === 0 ? '전 항목 PASS' : '실패 ' + failures + '건'));
process.exit(failures === 0 ? 0 : 1);
