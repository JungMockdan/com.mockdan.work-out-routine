import { NextResponse } from 'next/server';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { setSessionStatus } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED = new Set(['planned', 'in_progress', 'skipped']); // done은 /complete 전용

/** POST /api/sessions/[id]/status — 실행 시작/건너뜀 상태 갱신 (Supabase 모드) */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key: sessionId } = await ctx.params;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase 미설정 — localStorage 모드에서는 사용하지 않습니다.' }, { status: 501 });
  }
  if (!UUID_RE.test(sessionId)) return NextResponse.json({ error: '세션 id가 올바르지 않습니다.' }, { status: 400 });
  let body: { status?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }
  if (!body.status || !ALLOWED.has(body.status)) {
    return NextResponse.json({ error: '허용되지 않는 상태입니다.' }, { status: 400 });
  }
  try {
    const sb = await getSupabaseServer();
    const user = await getUser(sb);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    await setSessionStatus(sb, sessionId, body.status as 'planned' | 'in_progress' | 'skipped');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '상태 갱신에 실패했습니다.' }, { status: 500 });
  }
}
