/**
 * 운동 조합 엔진 (순수 함수, 런타임 의존성 0)
 *
 * 이 파일은 런타임 import가 전혀 없다. 운동 DB는 파라미터로 주입받는다(DI).
 * 덕분에 Next.js / React Native / Node 스크립트 어디서든 그대로 재사용 가능하다.
 */

/* ============================ 도메인 타입 ============================ */

/** 사용자가 선택하는 개선 목표 */
export type Concern =
  | 'rounded_shoulder' // 굽은 어깨(라운드 숄더)
  | 'forward_head'     // 거북목(전방 두부 자세)
  | 'hip_instability'  // 불안한 고관절
  | 'pelvic_tilt'      // 골반 불균형/전후방 경사
  | 'major_muscle';    // 대근육 강화

export const ALL_CONCERNS: Concern[] = [
  'rounded_shoulder',
  'forward_head',
  'hip_instability',
  'pelvic_tilt',
  'major_muscle',
];

export const CONCERN_LABEL_KO: Record<Concern, string> = {
  rounded_shoulder: '굽은 어깨',
  forward_head: '거북목',
  hip_instability: '불안한 고관절',
  pelvic_tilt: '골반 불균형',
  major_muscle: '대근육 강화',
};

/**
 * 교정운동 표준 흐름. 순서 자체가 세션 구성 순서다.
 * release(이완) -> mobility(가동성) -> activation(활성화) -> strength(강화) -> integration(통합/정리)
 */
export type Phase = 'release' | 'mobility' | 'activation' | 'strength' | 'integration';

export const PHASE_ORDER: Phase[] = ['release', 'mobility', 'activation', 'strength', 'integration'];

export const PHASE_LABEL_KO: Record<Phase, string> = {
  release: '이완 · 근막 릴리즈',
  mobility: '가동성',
  activation: '활성화',
  strength: '강화',
  integration: '통합 · 정리',
};

export type MuscleGroup =
  | 'neck_deep_flexor' | 'upper_trap' | 'lower_trap' | 'rhomboid' | 'rear_delt'
  | 'pec' | 'lat' | 'thoracic' | 'erector'
  | 'glute_max' | 'glute_med' | 'hamstring' | 'quad' | 'adductor' | 'hip_flexor'
  | 'core_anterior' | 'core_lateral' | 'calf' | 'full_body';

export type Equipment =
  | 'none' | 'mat' | 'wall' | 'band' | 'foam_roller' | 'ball'
  | 'dumbbell' | 'bench' | 'barbell' | 'cable';

export type Level = 1 | 2 | 3; // 1 입문 · 2 중급 · 3 상급

/** 운동 처방(세트/렙/휴식). 시간 계산의 유일한 근거. */
export interface Prescription {
  sets: number;
  /** 반복형 운동의 횟수 */
  reps?: number;
  /** 유지형 운동의 유지 시간(초) */
  holdSec?: number;
  /** 1회 반복 소요 초. 기본 3초(2초 수축 + 1초 이완) */
  tempoSec?: number;
  /** 세트 간 휴식(초) */
  restSec: number;
  /** 좌우 각각 수행 -> 운동 시간 2배 */
  perSide?: boolean;
}

export interface Exercise {
  id: string;
  nameKo: string;
  nameEn: string;
  phase: Phase;
  /** 각 목표에 대한 기여도 0~1. 합이 1일 필요는 없다. */
  targets: Partial<Record<Concern, number>>;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  /** 체감 강도 1~5. 사용자 레벨 매칭에 사용 */
  intensity: 1 | 2 | 3 | 4 | 5;
  equipment: Equipment[];
  prescription: Prescription;
  /** 수행 큐(코칭 포인트). 실행 화면에 노출 */
  cues: string[];
  /** 금기/주의 태그. 사용자의 avoidTags와 겹치면 제외 */
  contraindications?: string[];
  /** 2주차 난이도 상승 시 대체할 상위 운동 id */
  progressionId?: string;
  /** 영상/이미지 에셋 키. 콘텐츠 확보 전에는 null */
  mediaRef?: string | null;
}

/* ============================ 입력 / 출력 타입 ============================ */

export interface PlanInput {
  /** ISO 날짜 'YYYY-MM-DD' */
  startDate: string;
  endDate: string;
  /** 주당 운동 횟수 */
  daysPerWeek: 2 | 3 | 4 | 5;
  /** 1회 세션 목표 시간(분). 기본 40 */
  sessionMinutes: number;
  /** 선택한 개선 목표. 배열 순서 = 우선순위 */
  concerns: Concern[];
  level: Level;
  /** 사용 가능한 장비. 'none'과 'mat'은 항상 보유로 간주 */
  equipment: Equipment[];
  /** 사용자 금기 태그 (예: 'knee_pain', 'shoulder_impingement') */
  avoidTags?: string[];
  /** 재현 가능한 조합을 위한 시드 */
  seed?: number;
}

export interface PlannedExercise {
  exercise: Exercise;
  /** 레벨/주차 보정이 적용된 최종 처방 */
  prescription: Prescription;
  durationSec: number;
}

export interface Block {
  phase: Phase;
  budgetSec: number;
  actualSec: number;
  items: PlannedExercise[];
}

export interface SessionPlan {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 계획 전체에서의 회차 (1부터) */
  sessionIndex: number;
  /** 사이클 내 주차 (1 또는 2) */
  week: 1 | 2;
  /** 그날의 강조 부위 */
  focus: 'upper' | 'lower' | 'full';
  blocks: Block[];
  totalSec: number;
  /** 목표 시간 대비 오차(초). 음수면 짧음 */
  deltaSec: number;
}

export interface Plan {
  input: PlanInput;
  /** 목표 세션 시간(초) */
  targetSec: number;
  sessions: SessionPlan[];
  /** 운동하지 않는 날짜 */
  restDates: string[];
  warnings: string[];
}

/* ============================ 상수 ============================ */

/** 운동 간 전환(자리 이동/세팅) 시간 */
export const TRANSITION_SEC = 20;
/** 기본 템포: 1회 반복 3초 */
export const DEFAULT_TEMPO_SEC = 3;
/** 세션 시간 허용 오차 +-2분 */
export const TOLERANCE_SEC = 120;

/** 페이즈별 기본 시간 배분 비율. 합 = 1 */
const BASE_PHASE_RATIO: Record<Phase, number> = {
  release: 0.125,
  mobility: 0.15,
  activation: 0.175,
  strength: 0.425,
  integration: 0.125,
};

/**
 * 목표(concern)별 페이즈 예산 가중치.
 * 대근육 강화를 고르면 strength 비중이 올라가고, 자세 교정 목표는 이완/활성화 비중이 올라간다.
 */
const CONCERN_PHASE_BIAS: Record<Concern, Partial<Record<Phase, number>>> = {
  rounded_shoulder: { release: 1.4, mobility: 1.3, activation: 1.3, strength: 0.8 },
  forward_head:     { release: 1.4, mobility: 1.2, activation: 1.4, strength: 0.75 },
  hip_instability:  { mobility: 1.2, activation: 1.5, strength: 0.95, integration: 1.1 },
  pelvic_tilt:      { release: 1.2, mobility: 1.3, activation: 1.3, strength: 0.9 },
  major_muscle:     { release: 0.7, mobility: 0.8, activation: 0.8, strength: 1.8, integration: 0.8 },
};

const UPPER_MUSCLES: MuscleGroup[] = [
  'neck_deep_flexor', 'upper_trap', 'lower_trap', 'rhomboid', 'rear_delt', 'pec', 'lat', 'thoracic',
];
const LOWER_MUSCLES: MuscleGroup[] = [
  'glute_max', 'glute_med', 'hamstring', 'quad', 'adductor', 'hip_flexor', 'calf', 'erector',
];

/* ============================ 유틸 ============================ */

/** 결정론적 PRNG (mulberry32). 같은 시드 -> 같은 루틴. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 'YYYY-MM-DD' -> UTC Date. 타임존 이슈를 피하려 항상 UTC로 다룬다. */
export function parseDate(iso: string): Date {
  const parts = iso.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d.getTime());
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

export function eachDate(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  let cur = parseDate(startISO);
  const end = parseDate(endISO);
  while (cur.getTime() <= end.getTime()) {
    out.push(formatDate(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

/* ============================ 시간 계산 ============================ */

/** 운동 1종의 총 소요 시간(초). 전환 시간 포함. */
export function durationOf(p: Prescription): number {
  const tempo = p.tempoSec != null ? p.tempoSec : DEFAULT_TEMPO_SEC;
  const oneSet = p.holdSec != null ? p.holdSec : (p.reps != null ? p.reps : 10) * tempo;
  const sided = p.perSide ? oneSet * 2 : oneSet;
  const work = sided * p.sets;
  const rest = p.restSec * Math.max(0, p.sets - 1);
  return Math.round(work + rest + TRANSITION_SEC);
}

/** 선택한 목표 목록 -> 정규화된 가중치. 앞에 고른 것일수록 높다. */
export function concernWeights(concerns: Concern[]): Partial<Record<Concern, number>> {
  const out: Partial<Record<Concern, number>> = {};
  if (concerns.length === 0) {
    // 목표 미선택 시 균등 배분
    for (const c of ALL_CONCERNS) out[c] = 1 / ALL_CONCERNS.length;
    return out;
  }
  // 1순위 1.0, 이후 0.85배씩 감쇠 후 정규화
  let w = 1;
  let sum = 0;
  const tmp: Array<[Concern, number]> = [];
  for (const c of concerns) {
    tmp.push([c, w]);
    sum += w;
    w *= 0.85;
  }
  for (const pair of tmp) out[pair[0]] = pair[1] / sum;
  return out;
}

/** 목표 가중치를 반영한 페이즈별 시간 예산(초) */
export function phaseBudgets(
  totalSec: number,
  weights: Partial<Record<Concern, number>>,
): Record<Phase, number> {
  const raw: Record<Phase, number> = { release: 0, mobility: 0, activation: 0, strength: 0, integration: 0 };
  for (const phase of PHASE_ORDER) {
    let bias = 0;
    let wsum = 0;
    for (const c of ALL_CONCERNS) {
      const w = weights[c] != null ? (weights[c] as number) : 0;
      if (w <= 0) continue;
      const b = CONCERN_PHASE_BIAS[c][phase];
      bias += w * (b != null ? b : 1);
      wsum += w;
    }
    raw[phase] = BASE_PHASE_RATIO[phase] * (wsum > 0 ? bias / wsum : 1);
  }
  let sum = 0;
  for (const p of PHASE_ORDER) sum += raw[p];
  const out: Record<Phase, number> = { release: 0, mobility: 0, activation: 0, strength: 0, integration: 0 };
  for (const p of PHASE_ORDER) out[p] = Math.round((raw[p] / sum) * totalSec);
  return out;
}

/* ============================ 처방 보정 ============================ */

/** 레벨/주차에 따라 세트·렙·휴식을 조정한 처방을 만든다. */
export function adjustPrescription(base: Prescription, level: Level, week: 1 | 2): Prescription {
  const p: Prescription = { ...base };

  // 레벨 보정: 입문은 볼륨을 줄이고 휴식을 늘린다
  if (level === 1) {
    if (p.sets >= 3) p.sets = p.sets - 1;
    p.restSec = Math.round(p.restSec * 1.2);
  } else if (level === 3) {
    if (p.reps != null) p.reps = Math.round(p.reps * 1.15);
    if (p.holdSec != null) p.holdSec = Math.round(p.holdSec * 1.15);
    p.restSec = Math.round(p.restSec * 0.85);
  }

  // 2주차 점진적 과부하: 볼륨 +12%, 휴식 -10%
  if (week === 2) {
    if (p.reps != null) p.reps = Math.round(p.reps * 1.12);
    if (p.holdSec != null) p.holdSec = Math.round(p.holdSec * 1.12);
    p.restSec = Math.max(10, Math.round(p.restSec * 0.9));
  }

  return p;
}

/* ============================ 조합(선택) 알고리즘 ============================ */

export interface ScoreContext {
  weights: Partial<Record<Concern, number>>;
  level: Level;
  focus: 'upper' | 'lower' | 'full';
  /** 이번 세션에서 이미 선택된 운동의 primary 근육 사용 횟수 */
  usedMuscles: Map<MuscleGroup, number>;
  /** 사이클 전체에서 해당 운동이 쓰인 횟수 */
  usageCount: Map<string, number>;
  rng: () => number;
}

/** 운동 1종의 적합도 점수. 높을수록 먼저 선택된다. */
export function scoreExercise(ex: Exercise, ctx: ScoreContext): number {
  // 1) 목표 적합도 (지배적 항)
  let match = 0;
  for (const c of ALL_CONCERNS) {
    const w = ctx.weights[c] != null ? (ctx.weights[c] as number) : 0;
    if (w <= 0) continue;
    const t = ex.targets[c];
    match += w * (t != null ? t : 0);
  }
  let score = match * 100;

  // 2) 그날 강조 부위 보너스
  let inUpper = false;
  let inLower = false;
  for (const m of ex.primaryMuscles) {
    if (UPPER_MUSCLES.indexOf(m) >= 0) inUpper = true;
    if (LOWER_MUSCLES.indexOf(m) >= 0) inLower = true;
  }
  if (ctx.focus === 'upper' && inUpper) score += 12;
  if (ctx.focus === 'lower' && inLower) score += 12;
  if (ctx.focus === 'upper' && inLower && !inUpper) score -= 8;
  if (ctx.focus === 'lower' && inUpper && !inLower) score -= 8;

  // 3) 같은 세션 내 근육 중복 패널티 (한 부위만 과하게 때리는 것 방지)
  let overlap = 0;
  for (const m of ex.primaryMuscles) {
    const n = ctx.usedMuscles.get(m);
    overlap += n != null ? n : 0;
  }
  score -= overlap * 14;

  // 4) 사이클 내 반복 사용 패널티 (2주 내내 같은 운동만 나오는 것 방지)
  const used = ctx.usageCount.get(ex.id);
  score -= (used != null ? used : 0) * 9;

  // 5) 레벨 대비 강도 차이 패널티
  const idealIntensity = ctx.level === 1 ? 2 : ctx.level === 2 ? 3 : 4;
  score -= Math.abs(ex.intensity - idealIntensity) * 6;

  // 6) 결정론적 미세 흔들림 (동점 처리 + 자연스러운 다양성)
  score += ctx.rng() * 4;

  return score;
}

function isAvailable(ex: Exercise, owned: Set<Equipment>, avoid: Set<string>): boolean {
  for (const e of ex.equipment) {
    if (e === 'none' || e === 'mat') continue;
    if (!owned.has(e)) return false;
  }
  const contra = ex.contraindications != null ? ex.contraindications : [];
  for (const tag of contra) {
    if (avoid.has(tag)) return false;
  }
  return true;
}

/**
 * 한 페이즈 블록을 예산에 맞게 그리디로 채운다.
 * 예산을 크게 초과하는 후보는 건너뛰고, 남는 시간이 너무 작으면 종료한다.
 */
function fillBlock(
  phase: Phase,
  budgetSec: number,
  pool: Exercise[],
  ctx: ScoreContext,
  week: 1 | 2,
): Block {
  const items: PlannedExercise[] = [];
  const chosen = new Set<string>();
  let remaining = budgetSec;

  const candidates = pool.filter((e) => e.phase === phase);
  const slack = Math.min(45, budgetSec * 0.1);

  while (remaining > 0 && items.length < 8) {
    let best: Exercise | null = null;
    let bestScore = -Infinity;
    let bestRx: Prescription | null = null;
    let bestDur = 0;

    for (const ex of candidates) {
      if (chosen.has(ex.id)) continue;
      const rx = adjustPrescription(ex.prescription, ctx.level, week);
      const dur = durationOf(rx);
      if (dur > remaining + slack) continue; // 예산 초과 후보 제외
      const s = scoreExercise(ex, ctx);
      if (s > bestScore) {
        best = ex;
        bestScore = s;
        bestRx = rx;
        bestDur = dur;
      }
    }

    if (best == null || bestRx == null) break;

    items.push({ exercise: best, prescription: bestRx, durationSec: bestDur });
    chosen.add(best.id);
    const prev = ctx.usageCount.get(best.id);
    ctx.usageCount.set(best.id, (prev != null ? prev : 0) + 1);
    for (const m of best.primaryMuscles) {
      const n = ctx.usedMuscles.get(m);
      ctx.usedMuscles.set(m, (n != null ? n : 0) + 1);
    }
    remaining -= bestDur;

    if (remaining < 45) break; // 어떤 운동도 못 넣을 만큼 작으면 종료
  }

  let actualSec = 0;
  for (const i of items) actualSec += i.durationSec;
  return { phase, budgetSec, actualSec, items };
}

function blockTotal(blocks: Block[]): number {
  let t = 0;
  for (const b of blocks) t += b.actualSec;
  return t;
}

function recalc(b: Block): void {
  let t = 0;
  for (const i of b.items) t += i.durationSec;
  b.actualSec = t;
}

/** 세션 총 시간이 목표 +-허용오차 안에 들도록 세트/휴식을 미세 조정한다. */
function trimToTarget(blocks: Block[], targetSec: number): void {
  // 부족하면 strength 블록의 마지막 운동 세트를 늘린다
  let guard = 0;
  while (blockTotal(blocks) < targetSec - TOLERANCE_SEC && guard++ < 20) {
    const strength = blocks.find((b) => b.phase === 'strength' && b.items.length > 0);
    const target = strength != null ? strength : blocks.find((b) => b.items.length > 0);
    if (target == null) break;
    const last = target.items[target.items.length - 1];
    last.prescription = { ...last.prescription, sets: last.prescription.sets + 1 };
    last.durationSec = durationOf(last.prescription);
    recalc(target);
  }

  // 초과하면 휴식을 먼저 줄이고, 그래도 넘치면 세트를 줄인다
  guard = 0;
  while (blockTotal(blocks) > targetSec + TOLERANCE_SEC && guard++ < 40) {
    let changed = false;
    for (const b of blocks) {
      for (const it of b.items) {
        if (it.prescription.restSec > 15) {
          it.prescription = { ...it.prescription, restSec: it.prescription.restSec - 5 };
          it.durationSec = durationOf(it.prescription);
          changed = true;
        }
      }
      recalc(b);
    }
    if (changed) continue;

    const strength = blocks.find((b) => b.phase === 'strength' && b.items.length > 0);
    const target = strength != null ? strength : blocks.find((b) => b.items.length > 0);
    if (target == null) break;
    const last = target.items[target.items.length - 1];
    if (last.prescription.sets > 1) {
      last.prescription = { ...last.prescription, sets: last.prescription.sets - 1 };
      last.durationSec = durationOf(last.prescription);
    } else {
      target.items.pop();
    }
    recalc(target);
  }
}

/** 하루치 세션을 만든다. usageCount를 외부에서 주입해 사이클 전체의 다양성을 관리한다. */
export function buildSession(
  date: string,
  sessionIndex: number,
  week: 1 | 2,
  input: PlanInput,
  library: Exercise[],
  usageCount: Map<string, number>,
): SessionPlan {
  const targetSec = input.sessionMinutes * 60;
  const weights = concernWeights(input.concerns);
  const budgets = phaseBudgets(targetSec, weights);

  // 회차마다 상체/하체를 번갈아 강조하고, 3회차마다 전신으로 균형을 맞춘다
  const focus: 'upper' | 'lower' | 'full' =
    sessionIndex % 3 === 0 ? 'full' : sessionIndex % 2 === 1 ? 'upper' : 'lower';

  const owned = new Set<Equipment>(input.equipment);
  const avoid = new Set<string>(input.avoidTags != null ? input.avoidTags : []);
  const pool = library.filter((e) => isAvailable(e, owned, avoid));

  const ctx: ScoreContext = {
    weights,
    level: input.level,
    focus,
    usedMuscles: new Map<MuscleGroup, number>(),
    usageCount,
    rng: makeRng((input.seed != null ? input.seed : 42) * 7919 + sessionIndex * 104729),
  };

  const blocks: Block[] = PHASE_ORDER.map((phase) => fillBlock(phase, budgets[phase], pool, ctx, week));
  trimToTarget(blocks, targetSec);

  const totalSec = blockTotal(blocks);
  return { date, sessionIndex, week, focus, blocks, totalSec, deltaSec: totalSec - targetSec };
}

/** 주당 횟수 -> 요일 패턴 (0=일 … 6=토) */
export function weekdayPattern(daysPerWeek: 2 | 3 | 4 | 5): number[] {
  if (daysPerWeek === 2) return [2, 5];       // 화, 금
  if (daysPerWeek === 3) return [1, 3, 5];    // 월, 수, 금
  if (daysPerWeek === 4) return [1, 2, 4, 5]; // 월, 화, 목, 금
  return [1, 2, 3, 4, 5];                     // 월~금
}

/**
 * 시작일~종료일 전체 계획을 만든다.
 * 2주(14일)를 한 사이클로 보고, 기간이 길면 사이클을 반복하며 시드를 바꾼다.
 */
export function buildPlan(input: PlanInput, library: Exercise[]): Plan {
  const warnings: string[] = [];
  const targetSec = input.sessionMinutes * 60;

  if (input.concerns.length === 0) {
    warnings.push('개선 목표가 선택되지 않아 5개 목표를 균등 배분해 생성했습니다.');
  }

  const allDates = eachDate(input.startDate, input.endDate);
  if (allDates.length === 0) {
    return { input, targetSec, sessions: [], restDates: [], warnings: ['종료일이 시작일보다 빠릅니다.'] };
  }
  if (allDates.length < 14) {
    warnings.push('기간이 ' + allDates.length + '일로 2주 사이클보다 짧아 계획이 중간에 끝납니다.');
  }

  const pattern = new Set<number>(weekdayPattern(input.daysPerWeek));
  const start = parseDate(input.startDate);

  // 사이클 전체에서 사용 횟수를 공유해야 2주 내내 같은 운동이 반복되지 않는다
  const usage = new Map<string, number>();

  const sessions: SessionPlan[] = [];
  const restDates: string[] = [];
  let sessionIndex = 0;

  for (const iso of allDates) {
    const d = parseDate(iso);
    if (!pattern.has(d.getUTCDay())) {
      restDates.push(iso);
      continue;
    }
    const dayOffset = Math.round((d.getTime() - start.getTime()) / 86400000);
    const cycle = Math.floor(dayOffset / 14);
    const week: 1 | 2 = Math.floor((dayOffset % 14) / 7) === 0 ? 1 : 2;

    // 새 사이클 진입 시 사용 이력을 비우고 시드를 바꿔 새로운 조합이 나오게 한다
    if (cycle > 0 && dayOffset % 14 === 0) usage.clear();

    sessionIndex += 1;
    const cycleInput: PlanInput = {
      ...input,
      seed: (input.seed != null ? input.seed : 42) + cycle * 1000,
    };
    sessions.push(buildSession(iso, sessionIndex, week, cycleInput, library, usage));
  }

  if (sessions.length === 0) {
    warnings.push('선택한 기간 안에 해당 요일이 없어 세션이 생성되지 않았습니다.');
  }

  for (const s of sessions) {
    if (Math.abs(s.deltaSec) > TOLERANCE_SEC) {
      const min = Math.round((s.deltaSec / 60) * 10) / 10;
      warnings.push(s.date + ' 세션이 목표 시간에서 ' + min + '분 벗어났습니다.');
    }
  }

  return { input, targetSec, sessions, restDates, warnings };
}

/* ============================ 표시용 헬퍼 ============================ */

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? m + '분' : m + '분 ' + s + '초';
}

export function prescriptionLabel(p: Prescription): string {
  const unit = p.holdSec != null ? p.holdSec + '초 유지' : p.reps + '회';
  const side = p.perSide ? ' (좌우)' : '';
  return p.sets + '세트 × ' + unit + side + ' · 휴식 ' + p.restSec + '초';
}
