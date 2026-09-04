/**
 * Supabase exercises 테이블이 로컬 시드(src/data/exercises.ts)와 일치하는지 검증한다.
 * 실행:  node --env-file=.env.local scripts/verify-seed.ts
 * 필요:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { EXERCISES } from '../src/data/exercises.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. (--env-file=.env.local)');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

let fail = 0;
const check = (name: string, ok: boolean, detail = ''): void => {
  if (!ok) fail += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const { data: rows, error } = await sb
  .from('exercises')
  .select('id, name_ko, phase, equipment, intensity, primary_muscles, targets, contraindications, is_active');
if (error) { console.error('조회 실패:', error.message); process.exit(1); }

console.log('\n──────── Supabase 시드 검증 ────────\n');

check('총 행 수 74', rows.length === 74, rows.length + '행');

// 로컬 시드와 DB가 1:1로 일치하는가
const dbIds = new Set(rows.map((r) => r.id));
const localIds = new Set(EXERCISES.map((e) => e.id));
const missing = [...localIds].filter((i) => !dbIds.has(i));
const extra = [...dbIds].filter((i) => !localIds.has(i));
check('로컬 시드 → DB 누락 없음', missing.length === 0, missing.join(', ') || '0건');
check('DB에 유령 행 없음', extra.length === 0, extra.join(', ') || '0건');

// 신규 18종이 실제로 들어갔는가
const NEW = [
  'str-lat-pulldown', 'str-seated-row-machine', 'str-reverse-pec-deck', 'str-chest-press-machine',
  'str-shoulder-press-machine', 'str-leg-press', 'str-leg-extension', 'str-leg-curl-machine',
  'str-hip-abductor-machine', 'str-back-extension-machine', 'str-barbell-back-squat',
  'str-barbell-rdl', 'str-barbell-row', 'str-barbell-bench-press', 'str-barbell-hip-thrust',
  'str-cable-face-pull', 'str-cable-pallof', 'act-cable-hip-abduction',
];
const newMissing = NEW.filter((i) => !dbIds.has(i));
check('신규 18종 적재', newMissing.length === 0, newMissing.join(', ') || '18/18');

// 신규 기구 값이 문자열로 온전히 저장됐는가 (text[]라 오타가 조용히 통과할 수 있다)
const byId = new Map(rows.map((r) => [r.id, r]));
const eqMismatch: string[] = [];
for (const e of EXERCISES) {
  const r = byId.get(e.id);
  if (r == null) continue;
  const a = [...e.equipment].sort().join(',');
  const b = [...r.equipment].sort().join(',');
  if (a !== b) eqMismatch.push(`${e.id}: 로컬[${a}] vs DB[${b}]`);
}
check('전 74종 equipment 값 일치', eqMismatch.length === 0, eqMismatch.slice(0, 3).join(' / ') || '0건');

// delt(신규 MuscleGroup)가 저장됐는가
const deltRows = rows.filter((r) => (r.primary_muscles ?? []).includes('delt') || false);
check("신규 근육군 'delt' 저장", deltRows.length >= 1, deltRows.map((r) => r.name_ko).join(', '));

// 굽은 어깨 편향 방지가 DB에도 반영됐는가
const presses = ['str-chest-press-machine', 'str-barbell-bench-press'].map((i) => byId.get(i));
check(
  '흉근 프레스 targets에 rounded_shoulder 없음 (DB)',
  presses.every((r) => r != null && r.targets.rounded_shoulder == null),
);

// 금기 태그가 온전히 저장됐는가
const squat = byId.get('str-barbell-back-squat');
check(
  '바벨 백 스쿼트 금기 2건 저장',
  squat != null && ['knee_pain', 'lumbar_disc'].every((t) => (squat.contraindications ?? []).includes(t)),
  squat != null ? (squat.contraindications ?? []).join(', ') : '행 없음',
);

// is_active
check('전 74종 is_active=true', rows.every((r) => r.is_active === true));

// phase 분포
const dist: Record<string, number> = {};
for (const r of rows) dist[r.phase] = (dist[r.phase] ?? 0) + 1;
console.log('\nphase 분포: ' + Object.entries(dist).map(([k, v]) => `${k} ${v}`).join(' · '));

// 헬스장 전용 기구를 쓰는 행 수
const GYM_ONLY = ['barbell', 'squat_rack', 'cable', 'lat_pulldown', 'seated_row', 'chest_press',
  'shoulder_press_machine', 'pec_deck', 'leg_press', 'leg_extension', 'leg_curl', 'hip_abductor', 'back_extension'];
const gymRows = rows.filter((r) => (r.equipment ?? []).some((e: string) => GYM_ONLY.includes(e)));
console.log('헬스장 전용 기구 사용 행: ' + gymRows.length + '종');

console.log('\n' + (fail === 0 ? '✅ 전체 통과\n' : `❌ ${fail}건 실패\n`));
process.exit(fail === 0 ? 0 : 1);
