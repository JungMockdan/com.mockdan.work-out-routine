/** Supabase 행(snake_case) ↔ 앱 모델(camelCase) 매핑 */
import type { Block, PlanInput } from '../engine';
import type { ExerciseLog, PlanStatus, SessionStatus, StoredPlan, StoredSession } from '../types';

export interface PlanRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_per_week: number;
  session_minutes: number;
  concerns: string[];
  level: number;
  equipment: string[];
  avoid_tags: string[];
  seed: number;
  status: PlanStatus;
  created_at: string;
}

export interface SessionRow {
  id: string;
  plan_id: string;
  date: string;
  session_index: number;
  week: 1 | 2;
  focus: 'upper' | 'lower' | 'full';
  blocks: Block[];
  total_sec: number;
  status: SessionStatus;
  completed_at: string | null;
  elapsed_sec: number | null;
}

export interface LogRow {
  session_id: string;
  exercise_id: string;
  completed_sets: number;
  rpe: number | null;
  pain_flag: boolean;
  note: string | null;
}

export function logFromRow(row: LogRow): ExerciseLog {
  return {
    exerciseId: row.exercise_id,
    completedSets: row.completed_sets,
    rpe: row.rpe ?? undefined,
    painFlag: row.pain_flag,
    note: row.note ?? undefined,
  };
}

export function planInputFromRow(row: PlanRow): PlanInput {
  return {
    startDate: row.start_date,
    endDate: row.end_date,
    daysPerWeek: row.days_per_week as 2 | 3 | 4 | 5,
    sessionMinutes: row.session_minutes,
    concerns: row.concerns as PlanInput['concerns'],
    level: row.level as 1 | 2 | 3,
    equipment: row.equipment as PlanInput['equipment'],
    avoidTags: row.avoid_tags,
    seed: row.seed,
  };
}

export function sessionFromRow(row: SessionRow, logs?: LogRow[]): StoredSession {
  const blocks = row.blocks;
  const totalSec = row.total_sec;
  return {
    id: row.id,
    planId: row.plan_id,
    date: row.date,
    sessionIndex: row.session_index,
    week: row.week,
    focus: row.focus,
    blocks,
    totalSec,
    deltaSec: 0, // 행에는 저장하지 않음 — 목표 대비 오차는 표시용이라 plan.targetSec에서 계산 가능
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    elapsedSec: row.elapsed_sec ?? undefined,
    logs: logs && logs.length > 0 ? logs.map(logFromRow) : undefined,
  };
}

export function planFromRows(
  plan: PlanRow,
  sessions: SessionRow[],
  restDates: string[] = [],
  logsBySession?: Map<string, LogRow[]>,
): StoredPlan {
  const targetSec = plan.session_minutes * 60;
  const mapped = sessions
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const m = sessionFromRow(s, logsBySession?.get(s.id));
      m.deltaSec = m.totalSec - targetSec;
      return m;
    });
  return {
    id: plan.id,
    input: planInputFromRow(plan),
    targetSec,
    status: plan.status,
    createdAt: plan.created_at,
    sessions: mapped,
    restDates,
    warnings: [],
  };
}

export function planRowValues(p: StoredPlan, userId: string): Omit<PlanRow, 'created_at'> {
  return {
    id: p.id,
    user_id: userId,
    start_date: p.input.startDate,
    end_date: p.input.endDate,
    days_per_week: p.input.daysPerWeek,
    session_minutes: p.input.sessionMinutes,
    concerns: p.input.concerns,
    level: p.input.level,
    equipment: p.input.equipment,
    avoid_tags: p.input.avoidTags ?? [],
    seed: p.input.seed ?? 0,
    status: p.status,
  };
}

export function sessionRowValues(s: StoredSession): Omit<SessionRow, 'completed_at'> {
  return {
    id: s.id,
    plan_id: s.planId,
    date: s.date,
    session_index: s.sessionIndex,
    week: s.week,
    focus: s.focus,
    blocks: s.blocks,
    total_sec: s.totalSec,
    status: s.status,
    elapsed_sec: s.elapsedSec ?? null,
  };
}
