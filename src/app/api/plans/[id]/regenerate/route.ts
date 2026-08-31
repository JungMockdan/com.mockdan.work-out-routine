import { NextResponse } from 'next/server';
import { regeneratePlan } from '@/lib/plan-service';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { fetchPlanById, persistRegenerated, updateProfile } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/plans/[id]/regenerate  (SPEC 6)
 * 시드 변경 후 미수행 세션만 재생성 (완료분은 보존). Supabase 모드 전용.
 * 저장된 프로필(레벨/장비/금기)이 아니라 계획에 저장된 입력을 기준으로 하되,
 * body에 프로필 패치가 있으면 반영한다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase 미설정 — localStorage 모드는 /api/plans/regenerate 를 사용합니다.' }, { status: 501 });
  }
  if (!UUID_RE.test(id)) return NextResponse.json({ error: '계획 id가 올바르지 않습니다.' }, { status: 400 });
  try {
    const sb = await getSupabaseServer();
    const user = await getUser(sb);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const plan = await fetchPlanById(sb, id); // RLS로 본인 것만 조회됨
    if (!plan) return NextResponse.json({ error: '계획을 찾을 수 없습니다.' }, { status: 404 });

    // 저장된 프로필(설정 화면에서 수정한 레벨/장비/금기)을 먼저 반영한다 — LocalRepository와 동작 일치
    const { data: prof } = await sb
      .from('profiles')
      .select('level, equipment, avoid_tags')
      .eq('id', user.id)
      .maybeSingle();
    if (prof) {
      plan.input.level = prof.level as 1 | 2 | 3;
      plan.input.equipment = (prof.equipment ?? plan.input.equipment) as typeof plan.input.equipment;
      plan.input.avoidTags = prof.avoid_tags ?? plan.input.avoidTags;
    }

    const body = (await req.json().catch(() => ({}))) as {
      level?: 1 | 2 | 3;
      equipment?: string[];
      avoidTags?: string[];
    };
    if (body.level && [1, 2, 3].includes(body.level)) plan.input.level = body.level;
    if (Array.isArray(body.equipment)) plan.input.equipment = body.equipment as typeof plan.input.equipment;
    if (Array.isArray(body.avoidTags)) plan.input.avoidTags = body.avoidTags.slice(0, 20);

    const next = regeneratePlan(plan);
    await persistRegenerated(sb, next);
    await updateProfile(sb, user.id, {
      level: next.input.level,
      equipment: next.input.equipment,
      avoidTags: next.input.avoidTags ?? [],
    });
    const fresh = await fetchPlanById(sb, id);
    return NextResponse.json(fresh);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '재생성에 실패했습니다.' }, { status: 500 });
  }
}
