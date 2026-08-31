import { NextResponse } from 'next/server';
import { parsePlanInput, PlanInputError, regeneratePlan } from '@/lib/plan-service';
import { isValidISO } from '@/lib/dates';
import type { StoredPlan, StoredSession } from '@/lib/types';

export const runtime = 'nodejs';

const VALID_STATUS = new Set(['planned', 'in_progress', 'done', 'skipped']);
const MAX_SESSIONS = 400; // 1년 × 주5회 여유

/** 클라이언트 스냅샷의 세션이 최소 형태를 갖췄는지 검사한다. */
function isSaneSession(s: unknown): s is StoredSession {
  if (s == null || typeof s !== 'object') return false;
  const x = s as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.date === 'string' &&
    isValidISO(x.date) &&
    typeof x.status === 'string' &&
    VALID_STATUS.has(x.status) &&
    Array.isArray(x.blocks)
  );
}

/**
 * POST /api/plans/regenerate  (localStorage 모드 전용)
 * body: { plan: StoredPlan }
 * 클라이언트가 보유한 계획을 받아 시드를 바꿔 미수행 세션만 다시 조합한다.
 * 입력은 /api/plans와 동일하게 parsePlanInput으로 검증한다.
 */
export async function POST(req: Request) {
  let body: { plan?: StoredPlan };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }
  const plan = body.plan;
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.sessions)) {
    return NextResponse.json({ error: '계획 데이터가 올바르지 않습니다.' }, { status: 400 });
  }
  if (plan.sessions.length > MAX_SESSIONS) {
    return NextResponse.json({ error: '세션 수가 허용 범위를 초과했습니다.' }, { status: 400 });
  }
  try {
    const input = parsePlanInput(plan.input);
    const sane: StoredPlan = {
      ...plan,
      input,
      sessions: plan.sessions.filter(isSaneSession),
    };
    return NextResponse.json(regeneratePlan(sane));
  } catch (e) {
    if (e instanceof PlanInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: '재생성에 실패했습니다.' }, { status: 500 });
  }
}
