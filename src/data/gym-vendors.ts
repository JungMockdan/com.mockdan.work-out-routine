import type { Equipment } from '../lib/engine';

/**
 * 헬스장 기구 벤더 매핑 레이어
 *
 * ⚠️ 설계 규칙
 * - 운동 데이터(exercises.ts)와 조합 엔진(engine.ts)은 **제네릭 기구 값만** 사용한다.
 *   이 파일은 "제네릭 기구 → 특정 브랜드 제품명" 단방향 표시용 매핑일 뿐이며,
 *   엔진의 운동 선택 로직에는 절대 개입하지 않는다.
 * - 따라서 브랜드를 추가/삭제해도 플랜 생성 결과는 바뀌지 않는다.
 * - 사용자가 다니는 헬스장 브랜드를 골라두면 실행 화면에서 실제 기구명을 띄워
 *   "그 기구를 헬스장에서 바로 찾을 수 있게" 하는 용도다.
 *
 * 출처: DRAX 공식 제품 페이지 (draxfit.com/ko/strength) — 2026-09 확인
 */

export type GymVendor = 'drax';

export const GYM_VENDOR_LABEL: Record<GymVendor, string> = {
  drax: 'DRAX (디랙스)',
};

export interface VendorMachine {
  /** 제네릭 기구 축 값 */
  equipment: Equipment;
  /** 벤더 제품명 (한국어 표기) */
  nameKo: string;
  /** 벤더 제품명 (영문 표기) */
  nameEn: string;
  /** 제품 라인 (웰리브 / 웰리브 프로 / 벡터 / 퓨어 플레이트 / 랙&벤치 / 케이블 스테이션) */
  line: string;
}

/**
 * DRAX 제품군 매핑.
 * 라인이 여러 개인 기구는 가장 보편적으로 보급된 '웰리브' 기준으로 적었다.
 */
export const DRAX_MACHINES: VendorMachine[] = [
  { equipment: 'lat_pulldown',           nameKo: '웰리브 랫 풀다운',        nameEn: 'Welliv Lat Pull Down',      line: '웰리브' },
  { equipment: 'seated_row',             nameKo: '웰리브 시티드 로우',      nameEn: 'Welliv Seated Row',         line: '웰리브' },
  { equipment: 'chest_press',            nameKo: '웰리브 체스트 프레스',    nameEn: 'Welliv Chest Press',        line: '웰리브' },
  { equipment: 'shoulder_press_machine', nameKo: '웰리브 숄더 프레스',      nameEn: 'Welliv Shoulder Press',     line: '웰리브' },
  { equipment: 'pec_deck',               nameKo: '웰리브 펙덱 플라이',      nameEn: 'Welliv Pec Deck Fly',       line: '웰리브' },
  { equipment: 'leg_press',              nameKo: '웰리브 시티드 레그 프레스', nameEn: 'Welliv Seated Leg Press',  line: '웰리브' },
  { equipment: 'leg_extension',          nameKo: '웰리브 레그 익스텐션',    nameEn: 'Welliv Leg Extension',      line: '웰리브' },
  { equipment: 'leg_curl',               nameKo: '웰리브 시티드 레그컬',    nameEn: 'Welliv Seated Leg Curl',    line: '웰리브' },
  { equipment: 'hip_abductor',           nameKo: '웰리브 아웃터 사이',      nameEn: 'Welliv Outer Thigh',        line: '웰리브' },
  { equipment: 'back_extension',         nameKo: '웰리브 백 익스텐션',      nameEn: 'Welliv Back Extension',     line: '웰리브' },
  { equipment: 'cable',                  nameKo: '케이블 스테이션',         nameEn: 'Cable Station',             line: '케이블 스테이션' },
  { equipment: 'barbell',                nameKo: '올림픽 바벨 · 플레이트',  nameEn: 'Olympic Barbell / Plate',   line: '덤벨&플레이트' },
  { equipment: 'squat_rack',             nameKo: '파워 랙',                 nameEn: 'Power Rack',                line: '랙&벤치' },
  { equipment: 'dumbbell',               nameKo: '덤벨',                    nameEn: 'Dumbbell',                  line: '덤벨&플레이트' },
  { equipment: 'bench',                  nameKo: '멀티 벤치',               nameEn: 'Multi Bench',               line: '랙&벤치' },
];

export const VENDOR_MACHINES: Record<GymVendor, VendorMachine[]> = {
  drax: DRAX_MACHINES,
};

/** 제네릭 기구 값 → 해당 벤더의 제품명. 매핑이 없으면 null (제네릭 라벨을 그대로 쓴다) */
export function vendorMachineName(vendor: GymVendor | null, equipment: Equipment): string | null {
  if (vendor == null) return null;
  const found = VENDOR_MACHINES[vendor].find((m) => m.equipment === equipment);
  return found != null ? found.nameKo : null;
}
