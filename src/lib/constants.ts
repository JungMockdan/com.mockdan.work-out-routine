import type { Equipment, Level } from './engine';

export const EQUIPMENT_OPTIONS: Array<{ id: Equipment; label: string }> = [
  { id: 'band', label: '밴드' },
  { id: 'foam_roller', label: '폼롤러' },
  { id: 'ball', label: '마사지볼' },
  { id: 'wall', label: '벽' },
  { id: 'dumbbell', label: '덤벨' },
  { id: 'bench', label: '벤치' },
  { id: 'barbell', label: '바벨' },
  { id: 'cable', label: '케이블' },
];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: '맨몸',
  mat: '매트',
  wall: '벽',
  band: '밴드',
  foam_roller: '폼롤러',
  ball: '마사지볼',
  dumbbell: '덤벨',
  bench: '벤치',
  barbell: '바벨',
  cable: '케이블',
};

/** 통증 부위 → 금기 태그 (exercises.ts의 contraindications와 일치) */
export const AVOID_TAG_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'knee_pain', label: '무릎 통증', hint: '깊은 스쿼트·런지 제외' },
  { id: 'shoulder_impingement', label: '어깨 충돌·통증', hint: '팔 들어올리는 동작 제외' },
  { id: 'cervical_disc', label: '목 디스크', hint: '목 굴곡·압박 동작 제외' },
  { id: 'lumbar_disc', label: '허리 디스크', hint: '허리 굴곡 부하 제외' },
  { id: 'wrist_pain', label: '손목 통증', hint: '손목 체중 지지 제외' },
  { id: 'groin_strain', label: '사타구니 통증', hint: '내전근 스트레치 제외' },
  { id: 'dizziness', label: '어지럼증', hint: '머리 위치 급변 동작 제외' },
];

export const AVOID_TAG_LABEL: Record<string, string> = Object.fromEntries(
  AVOID_TAG_OPTIONS.map((o) => [o.id, o.label]),
);

export const LEVEL_OPTIONS: Array<{ id: Level; label: string; desc: string }> = [
  { id: 1, label: '입문', desc: '운동 경험이 거의 없다. 세트를 줄이고 휴식을 늘린다.' },
  { id: 2, label: '중급', desc: '주 1~2회 이상 꾸준히 운동한다.' },
  { id: 3, label: '상급', desc: '규칙적으로 운동하며 강도를 높이고 싶다.' },
];

export const CONCERN_DESC: Record<string, string> = {
  rounded_shoulder: '어깨가 앞으로 말려 있고 등이 굽어 보인다',
  forward_head: '머리가 앞으로 나와 있고 목·승모근이 자주 뻐근하다',
  hip_instability: '한 발 서기가 불안하고 고관절이 자주 걸린다',
  pelvic_tilt: '골반이 앞뒤/좌우로 틀어져 허리가 자주 아프다',
  major_muscle: '전반적인 근력·체력을 키우고 싶다',
};

export const FOCUS_LABEL: Record<'upper' | 'lower' | 'full', string> = {
  upper: '상체 강조',
  lower: '하체 강조',
  full: '전신',
};

/** SPEC 5.2 필수 고지 — 문구를 바꾸지 말 것 */
export const DISCLAIMER_LINES = [
  '본 서비스는 의학적 진단·치료가 아닙니다. 통증이 발생하면 즉시 중단하고 전문의와 상담하세요.',
  '급성 통증, 최근 수술, 임신 중이라면 시작 전 전문가와 상의하세요.',
];

export const DAYS_PER_WEEK_OPTIONS: Array<{ id: 2 | 3 | 4 | 5; label: string; days: string }> = [
  { id: 2, label: '주 2회', days: '화 · 금' },
  { id: 3, label: '주 3회', days: '월 · 수 · 금' },
  { id: 4, label: '주 4회', days: '월 · 화 · 목 · 금' },
  { id: 5, label: '주 5회', days: '월 ~ 금' },
];

export const STORAGE_KEYS = {
  plan: 'moccu.plan.v1',
  onboarding: 'moccu.onboarding.v1',
  progress: (date: string) => `moccu.progress.${date}`,
  pendingDone: (date: string) => `moccu.pending-done.${date}`,
} as const;
