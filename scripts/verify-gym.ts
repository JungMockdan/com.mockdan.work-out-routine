/**
 * 헬스장 모드 검증 스크립트.  실행:  npm run verify:gym
 *
 * 검증 항목
 *  1. 헬스장 프리셋 사용자에게 머신/바벨 운동이 실제로 배정되는가
 *  2. 홈 사용자(머신 미보유)에게는 헬스장 운동이 단 하나도 새지 않는가
 *  3. 기구 AND 조건이 지켜지는가 (바벨만 있고 랙이 없으면 백 스쿼트 제외)
 *  4. 헬스장 운동이 추가된 뒤에도 목표 시간 오차가 유지되는가
 *  5. 굽은 어깨 목표에 흉근 프레스가 핵심 운동으로 올라오지 않는가
 *  6. 금기 태그가 신규 헬스장 운동에도 적용되는가
 */
import {
  buildPlan,
  formatDuration,
  prescriptionLabel,
  GYM_EQUIPMENT,
  PHASE_LABEL_KO,
  TOLERANCE_SEC,
  type Equipment,
  type PlanInput,
  type Plan,
} from '../src/lib/engine.ts';
import { EXERCISES } from '../src/data/exercises.ts';
import { DRAX_MACHINES, vendorMachineName } from '../src/data/gym-vendors.ts';

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
  concerns: ['major_muscle', 'rounded_shoulder', 'hip_instability'],
  level: 2,
  equipment: [],
  avoidTags: [],
  seed: 42,
};

/** 머신/바벨 전용 기구 (홈 사용자는 절대 가질 수 없는 것) */
const GYM_ONLY: Equipment[] = GYM_EQUIPMENT.filter((e) => e !== 'dumbbell' && e !== 'bench');

function allIds(plan: Plan): string[] {
  const ids: string[] = [];
  for (const s of plan.sessions) for (const b of s.blocks) for (const i of b.items) ids.push(i.exercise.id);
  return ids;
}
function usesGymOnly(id: string): boolean {
  const ex = EXERCISES.find((e) => e.id === id);
  if (ex == null) return false;
  return ex.equipment.some((e) => GYM_ONLY.includes(e));
}

console.log('\n──────── 헬스장 모드 검증 ────────\n');

// 1. 헬스장 프리셋 → 머신 운동이 나온다
const gymPlan = buildPlan({ ...BASE, equipment: [...GYM_EQUIPMENT] }, EXERCISES);
const gymUsed = [...new Set(allIds(gymPlan).filter(usesGymOnly))];
check('헬스장 프리셋에 머신·바벨 운동 배정', gymUsed.length > 0, gymUsed.length + '종 사용');

// 2. 홈 사용자에게는 새지 않는다
const homePlan = buildPlan({ ...BASE, equipment: ['band', 'foam_roller', 'ball', 'wall'] }, EXERCISES);
const leaked = [...new Set(allIds(homePlan).filter(usesGymOnly))];
check('홈 사용자에게 헬스장 운동 미노출', leaked.length === 0, leaked.length === 0 ? '0건' : leaked.join(', '));

// 3. 기구 AND 조건 — 바벨만 있고 랙이 없으면 백 스쿼트 제외
const noRack = buildPlan({ ...BASE, equipment: ['barbell'] }, EXERCISES);
const squatIn = allIds(noRack).includes('str-barbell-back-squat');
check('랙 미보유 시 바벨 백 스쿼트 제외 (AND 조건)', !squatIn);
const withRack = buildPlan({ ...BASE, equipment: ['barbell', 'squat_rack'] }, EXERCISES);
check(
  '랙 보유 시 바벨 백 스쿼트 후보 진입',
  EXERCISES.some((e) => e.id === 'str-barbell-back-squat') && allIds(withRack).length > 0,
);

// 4. 시간 오차 유지
const offSpec = gymPlan.sessions.filter((s) => Math.abs(s.deltaSec) > TOLERANCE_SEC);
check('헬스장 플랜 전 세션 시간 오차 허용 범위', offSpec.length === 0, offSpec.length + '건 초과');

// 5. 굽은 어깨에 흉근 프레스가 핵심으로 잡히지 않는다
const pressTargets = EXERCISES.filter((e) => e.id === 'str-chest-press-machine' || e.id === 'str-barbell-bench-press');
const noRsBias = pressTargets.every((e) => e.targets.rounded_shoulder == null);
check('흉근 프레스 targets에 rounded_shoulder 없음', noRsBias && pressTargets.length === 2);

// 6. 금기 태그 적용
const kneePlan = buildPlan({ ...BASE, equipment: [...GYM_EQUIPMENT], avoidTags: ['knee_pain'] }, EXERCISES);
const kneeBad = allIds(kneePlan).filter((id) => {
  const ex = EXERCISES.find((e) => e.id === id);
  return ex != null && (ex.contraindications ?? []).includes('knee_pain');
});
check('무릎 통증 사용자에게 레그 프레스·스쿼트 제외', kneeBad.length === 0, kneeBad.length + '건');

// 7. DRAX 매핑이 모든 머신 기구를 덮는다
const unmapped = GYM_EQUIPMENT.filter((e) => vendorMachineName('drax', e) == null);
check('DRAX 매핑 커버리지', unmapped.length === 0, unmapped.length === 0 ? DRAX_MACHINES.length + '종 매핑' : unmapped.join(', '));

// ── 샘플 루틴 출력 ──
const sample = gymPlan.sessions[0];
console.log('\n──────── 샘플: 헬스장 모드 ' + sample.date + ' 1회차 ────────\n');
for (const b of sample.blocks) {
  if (b.items.length === 0) continue;
  console.log('▸ ' + PHASE_LABEL_KO[b.phase] + '  (' + formatDuration(b.actualSec) + ' / 예산 ' + formatDuration(b.budgetSec) + ')');
  for (const i of b.items) {
    const drax = i.exercise.equipment.map((e) => vendorMachineName('drax', e)).find((n) => n != null);
    const tag = drax != null ? '  ⟨' + drax + '⟩' : '';
    console.log('   · ' + i.exercise.nameKo.padEnd(22) + prescriptionLabel(i.prescription) + '  [' + formatDuration(i.durationSec) + ']' + tag);
  }
  console.log('');
}
console.log('총 ' + formatDuration(sample.totalSec) + ' (목표 40분, 오차 ' + sample.deltaSec + '초)');

console.log('\n헬스장 전용 운동 ' + gymUsed.length + '종 사용: ' + gymUsed.join(', ') + '\n');
console.log(failures === 0 ? '✅ 전체 통과\n' : '❌ ' + failures + '건 실패\n');
process.exit(failures === 0 ? 0 : 1);
