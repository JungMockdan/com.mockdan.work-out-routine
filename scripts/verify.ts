/**
 * 엔진 검증 스크립트.  실행:  npm run verify
 *
 * 검증 항목
 *  1. 모든 세션이 목표 시간 40분 ± 2분 안에 들어오는가
 *  2. 2주 사이클 안에서 운동이 과도하게 반복되지 않는가
 *  3. 장비 미보유 사용자도 정상적인 루틴을 받는가
 *  4. 같은 시드 -> 같은 결과인가 (재현성)
 *  5. 금기 태그가 실제로 제외되는가
 */
import {
  buildPlan,
  formatDuration,
  prescriptionLabel,
  PHASE_LABEL_KO,
  CONCERN_LABEL_KO,
  TOLERANCE_SEC,
  type PlanInput,
  type Plan,
} from '../src/lib/engine.ts';
import { EXERCISES } from '../src/data/exercises.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failures += 1;
  console.log('  [' + mark + '] ' + name + (detail ? ' — ' + detail : ''));
}

const BASE: PlanInput = {
  startDate: '2026-09-01',
  endDate: '2026-09-14',
  daysPerWeek: 4,
  sessionMinutes: 40,
  concerns: ['rounded_shoulder', 'forward_head', 'hip_instability', 'pelvic_tilt', 'major_muscle'],
  level: 2,
  equipment: ['band', 'foam_roller', 'ball', 'dumbbell', 'bench', 'wall'],
  avoidTags: [],
  seed: 42,
};

function timingOk(plan: Plan): boolean {
  return plan.sessions.every((s) => Math.abs(s.deltaSec) <= TOLERANCE_SEC);
}

/* ─────────── 1. 기본 시나리오: 전체 장비 보유, 5개 목표 전부 ─────────── */
console.log('\n[1] 기본 시나리오 (2026-09-01 ~ 09-14, 주 4회, 40분, 목표 5개 전부)');
const plan = buildPlan(BASE, EXERCISES);
check('세션 생성됨', plan.sessions.length === 8, plan.sessions.length + '회');
check('모든 세션이 40분 ±2분', timingOk(plan));
for (const s of plan.sessions) {
  const mins = Math.round((s.totalSec / 60) * 10) / 10;
  console.log(
    '      ' + s.date + ' | ' + s.sessionIndex + '회차 | ' + s.week + '주차 | ' +
    s.focus.padEnd(5) + ' | ' + mins + '분 | 운동 ' +
    s.blocks.reduce((n, b) => n + b.items.length, 0) + '종',
  );
}

/* ─────────── 2. 반복 다양성 ─────────── */
console.log('\n[2] 2주 사이클 내 운동 다양성');
const counts = new Map<string, number>();
for (const s of plan.sessions) {
  for (const b of s.blocks) {
    for (const it of b.items) {
      counts.set(it.exercise.id, (counts.get(it.exercise.id) ?? 0) + 1);
    }
  }
}
const maxRepeat = Math.max(...counts.values());
const uniqueCount = counts.size;
check('고유 운동 12종 이상 사용', uniqueCount >= 12, uniqueCount + '종');
check('한 운동이 8회(=전 세션) 반복되지 않음', maxRepeat < 8, '최대 ' + maxRepeat + '회');

/* ─────────── 3. 장비 미보유 사용자 ─────────── */
console.log('\n[3] 장비 미보유 (맨몸/매트만)');
const noGear = buildPlan({ ...BASE, equipment: [] }, EXERCISES);
check('세션 생성됨', noGear.sessions.length === 8);
check('모든 세션이 40분 ±2분', timingOk(noGear));
const emptyBlocks = noGear.sessions.flatMap((s) => s.blocks).filter((b) => b.items.length === 0);
check('빈 블록 없음', emptyBlocks.length === 0, emptyBlocks.length + '개 빈 블록');

/* ─────────── 4. 재현성 ─────────── */
console.log('\n[4] 재현성 (같은 시드 -> 같은 결과)');
const again = buildPlan(BASE, EXERCISES);
const sig = (p: Plan) =>
  p.sessions.map((s) => s.blocks.map((b) => b.items.map((i) => i.exercise.id).join(',')).join('|')).join('#');
check('동일 시드 결과 일치', sig(plan) === sig(again));
const different = buildPlan({ ...BASE, seed: 777 }, EXERCISES);
check('다른 시드 결과 상이', sig(plan) !== sig(different));

/* ─────────── 5. 금기 태그 제외 ─────────── */
console.log('\n[5] 금기 태그 필터링 (무릎 통증)');
const kneeSafe = buildPlan({ ...BASE, avoidTags: ['knee_pain'] }, EXERCISES);
const hasKneeRisk = kneeSafe.sessions
  .flatMap((s) => s.blocks)
  .flatMap((b) => b.items)
  .some((i) => (i.exercise.contraindications ?? []).includes('knee_pain'));
check('knee_pain 금기 운동 미포함', !hasKneeRisk);
check('모든 세션이 40분 ±2분', timingOk(kneeSafe));

/* ─────────── 6. 단일 목표 시나리오 ─────────── */
console.log('\n[6] 단일 목표별 시간 검증');
for (const c of ['rounded_shoulder', 'forward_head', 'hip_instability', 'pelvic_tilt', 'major_muscle'] as const) {
  const p = buildPlan({ ...BASE, concerns: [c] }, EXERCISES);
  const worst = Math.max(...p.sessions.map((s) => Math.abs(s.deltaSec)));
  check(CONCERN_LABEL_KO[c], worst <= TOLERANCE_SEC, '최대 오차 ' + worst + '초');
}

/* ─────────── 샘플 세션 출력 ─────────── */
console.log('\n──────── 샘플: ' + plan.sessions[0].date + ' 1회차 루틴 ────────');
const sample = plan.sessions[0];
for (const b of sample.blocks) {
  console.log('\n▸ ' + PHASE_LABEL_KO[b.phase] + '  (' + formatDuration(b.actualSec) + ' / 예산 ' + formatDuration(b.budgetSec) + ')');
  for (const it of b.items) {
    console.log('   · ' + it.exercise.nameKo.padEnd(22, ' ') + prescriptionLabel(it.prescription) + '  [' + formatDuration(it.durationSec) + ']');
  }
}
console.log('\n총 ' + formatDuration(sample.totalSec) + ' (목표 40분, 오차 ' + sample.deltaSec + '초)');

if (plan.warnings.length > 0) console.log('\n경고: ' + plan.warnings.join(' / '));

console.log('\n' + (failures === 0 ? '✅ 전체 통과' : '❌ 실패 ' + failures + '건'));
process.exit(failures === 0 ? 0 : 1);
