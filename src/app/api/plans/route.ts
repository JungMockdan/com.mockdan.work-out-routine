import { NextResponse } from 'next/server';
import { createPlan, parsePlanInput, PlanInputError } from '@/lib/plan-service';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { persistPlan } from '@/lib/supabase/service';

export const runtime = 'nodejs';

/**
 * POST /api/plans  (SPEC 6)
 * body: { input: PlanInput, persist?: boolean }
 * 엔진을 서버에서 실행해 StoredPlan(blocks 스냅샷 포함)을 반환한다.
 * Supabase 모드 + persist=true 면 plans/sessions에 저장한다. localStorage 모드는 반환만.
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

    if (body.persist === true && isSupabaseServerConfigured()) {
      const sb = await getSupabaseServer();
      const user = await getUser(sb);
      if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
      await persistPlan(sb, plan, user.id);
    }

    return NextResponse.json(plan);
  } catch (e) {
    if (e instanceof PlanInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: '계획 생성에 실패했습니다.' }, { status: 500 });
  }
}
