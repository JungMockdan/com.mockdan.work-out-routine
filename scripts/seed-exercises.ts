/**
 * 운동 시드 DB를 Supabase exercises 테이블에 적재한다.
 * 실행:  node --env-file=.env.local scripts/seed-exercises.ts
 * 필요:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (서버 전용 키)
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

const rows = EXERCISES.map((e) => ({
  id: e.id,
  name_ko: e.nameKo,
  name_en: e.nameEn,
  phase: e.phase,
  targets: e.targets,
  primary_muscles: e.primaryMuscles,
  secondary_muscles: e.secondaryMuscles ?? [],
  intensity: e.intensity,
  equipment: e.equipment,
  prescription: e.prescription,
  cues: e.cues,
  contraindications: e.contraindications ?? [],
  progression_id: null as string | null, // 1차: FK 순서 문제 회피 위해 null로 적재
  media_ref: e.mediaRef ?? null,
  is_active: true,
}));

const { error } = await sb.from('exercises').upsert(rows, { onConflict: 'id' });
if (error) {
  console.error('시드 적재 실패:', error.message);
  process.exit(1);
}

// 2차: progression_id 채우기 (모든 id가 존재하는 상태에서)
const withProgression = EXERCISES.filter((e) => e.progressionId);
for (const e of withProgression) {
  const { error: e2 } = await sb.from('exercises').update({ progression_id: e.progressionId }).eq('id', e.id);
  if (e2) {
    console.error(`progression_id 갱신 실패 (${e.id}):`, e2.message);
    process.exit(1);
  }
}

console.log(`✅ ${rows.length}종 적재 완료 (progression ${withProgression.length}건 연결)`);
