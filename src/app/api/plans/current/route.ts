import { NextResponse } from 'next/server';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { fetchCurrentPlan } from '@/lib/supabase/service';
import { todayISO } from '@/lib/dates';

export const runtime = 'nodejs';

/** GET /api/plans/current  (SPEC 6) — 진행 중 계획 + 오늘 세션 */
export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase 미설정 — localStorage 모드에서는 사용하지 않습니다.' }, { status: 501 });
  }
  try {
    const sb = await getSupabaseServer();
    const user = await getUser(sb);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const plan = await fetchCurrentPlan(sb, user.id);
    const today = todayISO();
    const todaySession = plan?.sessions.find((s) => s.date === today) ?? null;
    return NextResponse.json({ plan, todaySession });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
  }
}
