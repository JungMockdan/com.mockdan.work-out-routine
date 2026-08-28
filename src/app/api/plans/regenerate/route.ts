import { NextResponse } from 'next/server';
import { regeneratePlan } from '@/lib/plan-service';
import type { StoredPlan } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * POST /api/plans/regenerate  (localStorage 모드 전용)
 * body: { plan: StoredPlan }
 * 클라이언트가 보유한 계획을 받아 시드를 바꿔 미수행 세션만 다시 조합한다.
 * Supabase 모드는 /api/plans/[id]/regenerate 를 사용한다.
 */
export async function POST(req: Request) {
  let body: { plan?: StoredPlan };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }
  const plan = body.plan;
  if (!plan || !plan.input || !Array.isArray(plan.sessions)) {
    return NextResponse.json({ error: '계획 데이터가 올바르지 않습니다.' }, { status: 400 });
  }
  try {
    return NextResponse.json(regeneratePlan(plan));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '재생성에 실패했습니다.' }, { status: 500 });
  }
}
