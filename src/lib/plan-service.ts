/**
 * 계획 생성/재생성 서비스. 서버(API 라우트)에서만 엔진을 실행한다.
 * 엔진 출력 blocks는 그대로 스냅샷으로 저장 모델에 복사된다.
 */
import { buildPlan, parseDate, ALL_CONCERNS, type Concern, type Equipment, type PlanInput } from './engine';
import { EXERCISES } from '@/data/exercises';
import type { StoredPlan, StoredSession } from './types';
import { isValidISO } from './dates';

const VALID_EQUIPMENT: Equipment[] = [
  'none', 'mat', 'wall', 'band', 'foam_roller', 'ball', 'dumbbell', 'bench', 'barbell', 'cable',
];

export class PlanInputError extends Error {}

/** 외부 입력을 PlanInput으로 정규화·검증한다. 실패 시 PlanInputError. */
export function parsePlanInput(raw: unknown): PlanInput {
  if (raw == null || typeof raw !== 'object') throw new PlanInputError('입력이 비어 있습니다.');
  const r = raw as Record<string, unknown>;

  const startDate = String(r.startDate ?? '');
  const endDate = String(r.endDate ?? '');
  if (!isValidISO(startDate) || !isValidISO(endDate)) throw new PlanInputError('날짜 형식이 올바르지 않습니다.');
  if (endDate < startDate) throw new PlanInputError('종료일이 시작일보다 빠릅니다.');
  const spanDays = (parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86_400_000 + 1;
  if (spanDays > 366) throw new PlanInputError('기간은 최대 1년(366일)까지 가능합니다.');

  const daysPerWeek = Number(r.daysPerWeek);
  if (![2, 3, 4, 5].includes(daysPerWeek)) throw new PlanInputError('주당 횟수는 2~5회여야 합니다.');

  const sessionMinutes = r.sessionMinutes == null ? 40 : Number(r.sessionMinutes);
  if (!Number.isFinite(sessionMinutes) || sessionMinutes < 20 || sessionMinutes > 90) {
    throw new PlanInputError('세션 시간은 20~90분이어야 합니다.');
  }

  const concernsRaw = Array.isArray(r.concerns) ? r.concerns : [];
  const concerns: Concern[] = [];
  for (const c of concernsRaw) {
    if (ALL_CONCERNS.includes(c as Concern) && !concerns.includes(c as Concern)) concerns.push(c as Concern);
  }

  const level = Number(r.level);
  if (![1, 2, 3].includes(level)) throw new PlanInputError('레벨은 1~3이어야 합니다.');

  const equipmentRaw = Array.isArray(r.equipment) ? r.equipment : [];
  const equipment = equipmentRaw.filter((e): e is Equipment => VALID_EQUIPMENT.includes(e as Equipment));

  const avoidRaw = Array.isArray(r.avoidTags) ? r.avoidTags : [];
  const avoidTags = avoidRaw.filter((t): t is string => typeof t === 'string' && t.length <= 40).slice(0, 20);

  const seed = r.seed == null ? undefined : Number(r.seed);
  if (seed != null && !Number.isInteger(seed)) throw new PlanInputError('시드는 정수여야 합니다.');

  return {
    startDate,
    endDate,
    daysPerWeek: daysPerWeek as 2 | 3 | 4 | 5,
    sessionMinutes,
    concerns,
    level: level as 1 | 2 | 3,
    equipment,
    avoidTags,
    seed,
  };
}

function newId(): string {
  return crypto.randomUUID();
}

/** 새 계획 생성. 시드가 없으면 하나 뽑아 고정한다(재현성). */
export function createPlan(input: PlanInput, now: Date = new Date()): StoredPlan {
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const fixed: PlanInput = { ...input, seed };
  const plan = buildPlan(fixed, EXERCISES);
  const planId = newId();
  const sessions: StoredSession[] = plan.sessions.map((s) => ({
    ...s,
    id: newId(),
    planId,
    status: 'planned',
  }));
  return {
    id: planId,
    input: fixed,
    targetSec: plan.targetSec,
    status: 'active',
    createdAt: now.toISOString(),
    sessions,
    restDates: plan.restDates,
    warnings: plan.warnings,
  };
}

/**
 * 재생성: 시드를 바꿔 다시 조합하되, 이미 완료/건너뛴/진행 중 세션은 그대로 보존한다.
 * 같은 planId, 같은 sessionId를 유지한다(캘린더·기록 링크가 깨지지 않게).
 */
export function regeneratePlan(current: StoredPlan, newSeed?: number): StoredPlan {
  const seed = newSeed ?? (current.input.seed ?? 42) + 1;
  const input: PlanInput = { ...current.input, seed };
  const fresh = buildPlan(input, EXERCISES);
  const keep = new Map<string, StoredSession>();
  for (const s of current.sessions) {
    if (s.status === 'done' || s.status === 'skipped' || s.status === 'in_progress') keep.set(s.date, s);
  }
  const byDate = new Map(current.sessions.map((s) => [s.date, s]));
  const sessions: StoredSession[] = fresh.sessions.map((s) => {
    const kept = keep.get(s.date);
    if (kept) return kept;
    const prev = byDate.get(s.date);
    return { ...s, id: prev?.id ?? newId(), planId: current.id, status: 'planned' };
  });
  return {
    ...current,
    input,
    sessions,
    restDates: fresh.restDates,
    warnings: fresh.warnings,
  };
}
