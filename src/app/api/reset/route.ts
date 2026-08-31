import { NextResponse } from 'next/server';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { resetUserData } from '@/lib/supabase/service';

export const runtime = 'nodejs';

/** POST /api/reset — 사용자 데이터 초기화 (Supabase 모드; SPEC 5 /settings 요구) */
export async function POST() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase 미설정 — localStorage 모드에서는 사용하지 않습니다.' }, { status: 501 });
  }
  try {
    const sb = await getSupabaseServer();
    const user = await getUser(sb);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await resetUserData(sb, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '초기화에 실패했습니다.' }, { status: 500 });
  }
}
