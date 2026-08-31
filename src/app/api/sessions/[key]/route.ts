import { NextResponse } from 'next/server';
import { isValidISO, todayISO } from '@/lib/dates';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { fetchCurrentPlan } from '@/lib/supabase/service';

export const runtime = 'nodejs';

/** GET /api/sessions/[date]  (SPEC 6) — 해당 일 세션 상세 (진행 중 계획 기준) */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key: date } = await ctx.params;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase 미설정 — localStorage 모드에서는 사용하지 않습니다.' }, { status: 501 });
  }
  if (!isValidISO(date)) return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 });
  try {
    const sb = await getSupabaseServer();
    const user = await getUser(sb);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const plan = await fetchCurrentPlan(sb, user.id);
    const session = plan?.sessions.find((s) => s.date === date) ?? null;
    if (!session) return NextResponse.json({ session: null, date: todayISO() }, { status: 404 });
    return NextResponse.json({ session });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '조회에 실패했습니다.' }, { status: 500 });
  }
}
