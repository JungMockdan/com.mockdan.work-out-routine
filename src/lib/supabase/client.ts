'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** 브라우저 Supabase 클라이언트 (쿠키 기반 — 서버 라우트와 세션 공유) */
export function getSupabaseBrowser(): SupabaseClient {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

/**
 * 익명 로그인 보장. 로그인 UI는 SPEC 범위 밖이므로(화면 목록에 없음)
 * Supabase Anonymous Sign-in으로 사용자를 만든다.
 * 프로젝트 설정에서 Authentication → Anonymous sign-ins 를 켜야 한다.
 */
export async function ensureAuth(): Promise<string> {
  const sb = getSupabaseBrowser();
  const { data: sess } = await sb.auth.getSession();
  if (sess.session?.user) return sess.session.user.id;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) throw new Error('로그인에 실패했습니다: ' + (error?.message ?? 'unknown'));
  return data.user.id;
}
