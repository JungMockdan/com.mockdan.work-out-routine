import { NextResponse } from 'next/server';
import { createPlan, parsePlanInput, PlanInputError } from '@/lib/plan-service';

export const runtime = 'nodejs';

/**
 * POST /api/plans
 * body: { input: PlanInput, persist?: boolean }
 * 엔진을 서버에서 실행해 StoredPlan(blocks 스냅샷 포함)을 반환한다.
 * Supabase 모드에서는 persist=true일 때 plans/sessions에 저장한다(6단계).
 */
export async function POST(req: Request) {
  let body: { input?: unknown; persist?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }
  try {
    const input = parsePlanInput(body.input);
    const plan = createPlan(input);
    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof PlanInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: '계획 생성에 실패했습니다.' }, { status: 500 });
  }
}
