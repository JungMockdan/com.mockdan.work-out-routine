/**
 * 실행 화면 상태 머신 검증.  실행:  node scripts/verify-runner.ts
 *
 *  1. buildSteps() 예상 시간 합 == 엔진 durationOf() 합 (== session.totalSec)
 *  2. 절대 시각 시뮬레이션: 백그라운드 점프 후에도 시간이 밀리지 않는다
 *  3. reps형은 자동 진행되지 않고, 수동 완료 시 세트가 기록된다
 *  4. 일시정지/재개가 경과 시간에 포함되지 않는다
 *  5. 건너뛰기: 해당 운동의 남은 스텝을 모두 지나간다
 */
import { buildPlan, type PlanInput } from '../src/lib/engine.ts';
import { EXERCISES } from '../src/data/exercises.ts';
import {
  buildSteps,
  completeStep,
  initialState,
  pause,
  resume,
  skipExercise,
  stepRemainingSec,
  syncToNow,
  totalElapsedSec,
} from '../src/lib/session-runner.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log('  [' + (ok ? 'PASS' : 'FAIL') + '] ' + name + (detail ? ' — ' + detail : ''));
  if (!ok) failures += 1;
}

const INPUTS: PlanInput[] = [
  {
    startDate: '2026-09-01', endDate: '2026-09-14', daysPerWeek: 4, sessionMinutes: 40,
    concerns: ['rounded_shoulder', 'forward_head'], level: 2,
    equipment: ['band', 'foam_roller', 'ball', 'wall'], avoidTags: [], seed: 42,
  },
  {
    startDate: '2026-09-01', endDate: '2026-09-14', daysPerWeek: 3, sessionMinutes: 40,
    concerns: ['major_muscle'], level: 3,
    equipment: ['dumbbell', 'bench', 'band'], avoidTags: ['knee_pain'], seed: 7,
  },
  {
    startDate: '2026-09-01', endDate: '2026-09-14', daysPerWeek: 2, sessionMinutes: 40,
    concerns: ['hip_instability', 'pelvic_tilt'], level: 1,
    equipment: [], avoidTags: [], seed: 99,
  },
];

console.log('\n■ 1. 스텝 예상 시간 합 == session.totalSec');
for (const input of INPUTS) {
  const plan = buildPlan(input, EXERCISES);
  for (const s of plan.sessions) {
    const steps = buildSteps(s);
    const sum = steps.reduce((n, st) => n + st.estimatedSec, 0);
    if (sum !== s.totalSec) {
      check(`${s.date} 합계 일치`, false, `steps=${sum}s, session=${s.totalSec}s`);
    }
  }
}
check('전 세션 스텝 합계 == totalSec', failures === 0);

const plan = buildPlan(INPUTS[0], EXERCISES);
const session = plan.sessions[0];
const steps = buildSteps(session);

console.log('\n■ 2. 백그라운드 점프(절대 시각) 보정');
{
  const t0 = 1_000_000;
  let st = initialState(t0);
  // 첫 스텝은 transition 20초. 5분(300초) 뒤에 복귀했다고 가정 → 카운트다운 스텝들이 연쇄로 넘어가야 한다
  st = syncToNow(steps, st, t0 + 300_000);
  const expectedMin = steps.findIndex((x) => x.durationSec == null); // 첫 reps 스텝에서 멈춤
  const firstRepsIdx = expectedMin === -1 ? steps.length : expectedMin;
  check('reps 스텝(또는 그 이전 300초 지점)에서 멈춤', st.stepIndex <= firstRepsIdx || st.finished,
    `stepIndex=${st.stepIndex}, firstReps=${firstRepsIdx}`);
  // 흘려보낸 시간이 전부 반영됐는지: 카운트다운 스텝만 지난 경우 completedEstimatedSec + 현재 스텝 경과 == 300초
  const elapsed = totalElapsedSec(steps, st, t0 + 300_000);
  const curIsReps = steps[st.stepIndex] && steps[st.stepIndex].durationSec == null;
  if (curIsReps) {
    check('경과 시간 손실 없음(≤300초, 지난 스텝 합 유지)', st.completedEstimatedSec <= 300 && elapsed >= st.completedEstimatedSec,
      `completed=${st.completedEstimatedSec}s, elapsed=${Math.round(elapsed)}s`);
  } else {
    check('경과 시간 == 300초', Math.abs(elapsed - 300) < 1, `elapsed=${Math.round(elapsed)}s`);
  }
}

console.log('\n■ 3. reps형 수동 완료');
{
  // 시드에 상관없이 반드시 reps 스텝을 찾아 검증한다 (없으면 FAIL)
  let found: { steps: ReturnType<typeof buildSteps>; idx: number } | null = null;
  for (const input of INPUTS) {
    const pl = buildPlan(input, EXERCISES);
    for (const s of pl.sessions) {
      const ss = buildSteps(s);
      const i = ss.findIndex((x) => x.kind === 'work' && x.durationSec == null);
      if (i >= 0) {
        found = { steps: ss, idx: i };
        break;
      }
    }
    if (found) break;
  }
  check('reps형 스텝이 존재', found != null);
  if (found) {
    const t0 = 2_000_000;
    let now = t0;
    let st = initialState(t0);
    let guard = found.steps.length + 8;
    // 카운트다운은 시간을 흘려보내고, 중간에 만나는 reps는 수동 완료하며 목표 스텝까지 전진
    while (st.stepIndex < found.idx && guard-- > 0) {
      const cur = found.steps[st.stepIndex];
      if (cur.durationSec != null) {
        now += cur.durationSec * 1000;
        st = syncToNow(found.steps, st, now);
      } else {
        now += 30_000;
        st = completeStep(found.steps, st, now);
      }
    }
    const cur = found.steps[st.stepIndex];
    check('reps 스텝 도달', cur != null && cur.durationSec == null, `stepIndex=${st.stepIndex}/${found.idx}`);
    const before = st.completedSets[cur.exerciseId] ?? 0;
    const stale = syncToNow(found.steps, st, now + 3_600_000);
    check('reps 스텝은 1시간 방치해도 자동 진행 없음', stale.stepIndex === st.stepIndex);
    const done = completeStep(found.steps, st, now + 60_000);
    check('수동 완료 시 세트 +1', (done.completedSets[cur.exerciseId] ?? 0) === before + 1);
    check('수동 완료 시 다음 스텝으로', done.stepIndex === st.stepIndex + 1);
  }
}

console.log('\n■ 4. 일시정지 보정');
{
  const t0 = 3_000_000;
  let st = initialState(t0);
  st = pause(st, t0 + 5_000);            // 5초 진행 후 정지
  st = syncToNow(steps, st, t0 + 500_000); // 정지 중에는 sync가 아무것도 안 함
  check('정지 중 자동 진행 없음', st.stepIndex === 0 && st.pausedAt != null);
  st = resume(st, t0 + 500_000);          // 495초 정지 후 재개
  const rem = stepRemainingSec(steps, st, t0 + 500_000);
  check('재개 후 남은 시간 보존(20-5=15초)', rem != null && Math.abs(rem - 15) < 0.5, `rem=${rem?.toFixed(1)}s`);
}

console.log('\n■ 5. 운동 건너뛰기');
{
  const t0 = 4_000_000;
  let st = initialState(t0);
  const target = steps[0];
  st = skipExercise(steps, st, t0 + 1_000);
  const cur = steps[st.stepIndex];
  check('건너뛴 뒤 다른 운동으로 이동', !cur || cur.itemIndex !== target.itemIndex || cur.blockIndex !== target.blockIndex);
  check('skipped 목록에 기록', st.skipped.includes(target.exerciseId));
  const skippedEst = steps
    .filter((s) => s.blockIndex === target.blockIndex && s.itemIndex === target.itemIndex)
    .reduce((n, s) => n + s.estimatedSec, 0);
  check('건너뛴 시간이 경과로 계상됨(진행률 유지)', st.completedEstimatedSec === skippedEst,
    `completed=${st.completedEstimatedSec}s, expected=${skippedEst}s`);
  // 실제 소요(actualElapsedSec)는 벽시계 기준 1초만 계상되어야 한다 (예상치가 아니라)
  check('건너뛰기 실제 소요는 벽시계 기준(1초)', Math.abs(st.actualElapsedSec - 1) < 0.01,
    `actual=${st.actualElapsedSec}s`);
}

console.log(failures === 0 ? '\n✅ 전체 통과' : `\n❌ ${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
