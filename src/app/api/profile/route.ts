import { NextResponse } from 'next/server';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { fetchCurrentPlan, updateProfile } from '@/lib/supabase/service';

export const runtime = 'nodejs';

/** POST /api/profile — 설정 화면의 프로필 수정 (Supabase 모드; SPEC 5 /settings 요구) */
export async function POST(req: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase 미설정 — localStorage 모드에서는 사용하지 않습니다.' }, { status: 501 });
  }
  let body: { level?: number; equipment?: unknown; avoidTags?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }
  const level = Number(body.level);
  if (![1, 2, 3].includes(level)) return NextResponse.json({ error: '레벨은 1~3이어야 합니다.' }, { status: 400 });
  const equipment = Array.isArray(body.equipment) ? body.equipment.filter((e) => typeof e === 'string').slice(0, 20) : [];
  const avoidTags = Array.isArray(body.avoidTags) ? body.avoidTags.filter((t) => typeof t === 'string').slice(0, 20) : [];

  try {
    const sb = await getSupabaseServer();
    const user = await getUser(sb);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await updateProfile(sb, user.id, { level: level as 1 | 2 | 3, equipment, avoidTags });
    const plan = await fetchCurrentPlan(sb, user.id);
    return NextResponse.json({ plan });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '프로필 저장에 실패했습니다.' }, { status: 500 });
  }
}
