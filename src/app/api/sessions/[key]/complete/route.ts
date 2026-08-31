import { NextResponse } from 'next/server';
import { getSupabaseServer, getUser, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { completeSession } from '@/lib/supabase/service';
import type { CompletePayload } from '@/lib/types';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/sessions/[id]/complete  (SPEC 6) — 완료 처리 + session_logs 일괄 기록 */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key: sessionId } = await ctx.params;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase 미설정 — localStorage 모드에서는 사용하지 않습니다.' }, { status: 501 });
  }
  if (!UUID_RE.test(sessionId)) return NextResponse.json({ error: '세션 id가 올바르지 않습니다.' }, { status: 400 });

  let body: Partial<CompletePayload>;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }
  const elapsedSec = Number(body.elapsedSec);
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0 || elapsedSec > 6 * 3600) {
    return NextResponse.json({ error: 'elapsedSec이 올바르지 않습니다.' }, { status: 400 });
  }
  const rpe = body.rpe == null ? undefined : Number(body.rpe);
  if (rpe != null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
    return NextResponse.json({ error: 'RPE는 1~10이어야 합니다.' }, { status: 400 });
  }
  const logsRaw = Array.isArray(body.logs) ? body.logs : [];
  const logs = logsRaw
    .filter((l) => l && typeof l.exerciseId === 'string')
    .slice(0, 100)
    .map((l) => ({
      exerciseId: l.exerciseId,
      completedSets: Math.max(0, Math.min(50, Number(l.completedSets) || 0)),
      painFlag: Boolean(l.painFlag),
      note: undefined,
    }));

  try {
    const sb = await getSupabaseServer();
    const user = await getUser(sb);
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    const plan = await completeSession(sb, sessionId, {
      elapsedSec,
      rpe,
      painFlag: Boolean(body.painFlag),
      note: typeof body.note === 'string' ? body.note.slice(0, 500) : undefined,
      logs,
    });
    return NextResponse.json(plan);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : '완료 처리에 실패했습니다.' }, { status: 500 });
  }
}
