/**
 * Supabase 모드의 서버측 데이터 서비스 (라우트 핸들러 전용).
 * 모든 쿼리는 사용자 세션 클라이언트로 실행되어 RLS의 보호를 받는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { eachDate } from '../engine';
import type { CompletePayload, StoredPlan } from '../types';
import { planFromRows, planRowValues, sessionRowValues, type LogRow, type PlanRow, type SessionRow } from './mapping';

function restDatesOf(row: PlanRow, sessions: SessionRow[]): string[] {
  const have = new Set(sessions.map((s) => s.date));
  return eachDate(row.start_date, row.end_date).filter((d) => !have.has(d));
}

async function fetchSessions(sb: SupabaseClient, planId: string): Promise<SessionRow[]> {
  const { data, error } = await sb.from('sessions').select('*').eq('plan_id', planId).order('date');
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionRow[];
}

/** done 세션들의 수행 기록을 세션 id별로 묶어 가져온다 */
async function fetchLogs(sb: SupabaseClient, sessions: SessionRow[]): Promise<Map<string, LogRow[]>> {
  const doneIds = sessions.filter((s) => s.status === 'done').map((s) => s.id);
  const map = new Map<string, LogRow[]>();
  if (doneIds.length === 0) return map;
  const { data, error } = await sb.from('session_logs').select('*').in('session_id', doneIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as LogRow[]) {
    const list = map.get(row.session_id) ?? [];
    list.push(row);
    map.set(row.session_id, list);
  }
  return map;
}

async function assemblePlan(sb: SupabaseClient, row: PlanRow): Promise<StoredPlan> {
  const sessions = await fetchSessions(sb, row.id);
  const logs = await fetchLogs(sb, sessions);
  return planFromRows(row, sessions, restDatesOf(row, sessions), logs);
}

export async function fetchPlanById(sb: SupabaseClient, planId: string): Promise<StoredPlan | null> {
  const { data, error } = await sb.from('plans').select('*').eq('id', planId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return assemblePlan(sb, data as PlanRow);
}

/** 진행 중 계획 우선, 없으면 가장 최근의 완료된 계획(읽기용 — 캘린더 완료 표시·기록 열람) */
export async function fetchCurrentPlan(sb: SupabaseClient, userId: string): Promise<StoredPlan | null> {
  for (const status of ['active', 'completed'] as const) {
    const { data, error } = await sb
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return assemblePlan(sb, data as PlanRow);
  }
  return null;
}

/** 새 계획 저장: plans + sessions 스냅샷. 프로필도 최신 입력으로 upsert. */
export async function persistPlan(sb: SupabaseClient, plan: StoredPlan, userId: string): Promise<void> {
  const { error: pe } = await sb.from('profiles').upsert(
    {
      id: userId,
      level: plan.input.level,
      equipment: plan.input.equipment,
      avoid_tags: plan.input.avoidTags ?? [],
    },
    { onConflict: 'id' },
  );
  if (pe) throw new Error(pe.message);

  // 원자성 보강: 새 계획을 비활성(abandoned)으로 먼저 만들고 세션까지 성공한 뒤에
  // 기존 active를 내리고 새 계획을 active로 올린다. 중간 실패 시 기존 계획이 유지된다.
  const { error: ie } = await sb.from('plans').insert({ ...planRowValues(plan, userId), status: 'abandoned' });
  if (ie) throw new Error(ie.message);

  const rows = plan.sessions.map(sessionRowValues);
  const { error: se } = await sb.from('sessions').insert(rows);
  if (se) {
    await sb.from('plans').delete().eq('id', plan.id); // best-effort 정리
    throw new Error(se.message);
  }

  const { error: ae } = await sb
    .from('plans')
    .update({ status: 'abandoned' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('id', plan.id);
  if (ae) throw new Error(ae.message);

  const { error: fe } = await sb.from('plans').update({ status: plan.status }).eq('id', plan.id);
  if (fe) throw new Error(fe.message);
}

export async function setSessionStatus(
  sb: SupabaseClient,
  sessionId: string,
  status: 'planned' | 'in_progress' | 'done' | 'skipped',
): Promise<void> {
  const { error } = await sb.from('sessions').update({ status }).eq('id', sessionId);
  if (error) throw new Error(error.message);
}

/** 완료 처리 + session_logs 일괄 기록 → 갱신된 계획 반환 */
export async function completeSession(
  sb: SupabaseClient,
  sessionId: string,
  payload: CompletePayload,
): Promise<StoredPlan> {
  const { data: srow, error: ge } = await sb.from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (ge) throw new Error(ge.message);
  if (!srow) throw new Error('세션을 찾을 수 없습니다.');
  const session = srow as SessionRow;

  // 멱등성: 이미 완료된 세션이면 로그를 중복 기록하지 않고 현재 계획만 반환
  if (session.status === 'done') {
    const plan = await fetchPlanById(sb, session.plan_id);
    if (!plan) throw new Error('계획을 찾을 수 없습니다.');
    return plan;
  }

  const { error: ue } = await sb
    .from('sessions')
    .update({ status: 'done', completed_at: new Date().toISOString(), elapsed_sec: Math.round(payload.elapsedSec) })
    .eq('id', sessionId);
  if (ue) throw new Error(ue.message);

  if (payload.logs.length > 0) {
    const logRows = payload.logs.map((l) => ({
      session_id: sessionId,
      exercise_id: l.exerciseId,
      completed_sets: l.completedSets,
      rpe: payload.rpe ?? null,
      pain_flag: l.painFlag || payload.painFlag,
      note: payload.note ?? null,
    }));
    const { error: le } = await sb.from('session_logs').insert(logRows);
    if (le) throw new Error(le.message);
  }

  // 전 세션 완료 시 계획 completed
  const sessions = await fetchSessions(sb, session.plan_id);
  if (sessions.every((s) => s.status === 'done' || s.status === 'skipped')) {
    const { error: ce } = await sb.from('plans').update({ status: 'completed' }).eq('id', session.plan_id);
    if (ce) throw new Error(ce.message);
  }

  const plan = await fetchPlanById(sb, session.plan_id);
  if (!plan) throw new Error('계획을 찾을 수 없습니다.');
  return plan;
}

/** 재생성된 계획을 저장: 입력(시드·프로필 반영분) 갱신 + 세션 행 upsert(id 유지) */
export async function persistRegenerated(sb: SupabaseClient, plan: StoredPlan): Promise<void> {
  const { error: pe } = await sb
    .from('plans')
    .update({
      seed: plan.input.seed ?? 0,
      level: plan.input.level,
      equipment: plan.input.equipment,
      avoid_tags: plan.input.avoidTags ?? [],
    })
    .eq('id', plan.id);
  if (pe) throw new Error(pe.message);
  const rows = plan.sessions.map(sessionRowValues);
  const { error: se } = await sb.from('sessions').upsert(rows, { onConflict: 'id' });
  if (se) throw new Error(se.message);
}

export async function updateProfile(
  sb: SupabaseClient,
  userId: string,
  patch: { level: 1 | 2 | 3; equipment: string[]; avoidTags: string[] },
): Promise<void> {
  const { error } = await sb.from('profiles').upsert(
    { id: userId, level: patch.level, equipment: patch.equipment, avoid_tags: patch.avoidTags },
    { onConflict: 'id' },
  );
  if (error) throw new Error(error.message);
}

/** 사용자의 모든 계획 삭제 (sessions/logs는 FK cascade) */
export async function resetUserData(sb: SupabaseClient, userId: string): Promise<void> {
  const { error } = await sb.from('plans').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
