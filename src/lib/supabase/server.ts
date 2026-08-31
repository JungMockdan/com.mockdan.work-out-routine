import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export function isSupabaseServerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** 라우트 핸들러용 Supabase 클라이언트 (요청 쿠키의 세션 사용, RLS 적용) */
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            // Server Component에서 호출되면 쿠키를 쓸 수 없다 — 미들웨어가 갱신을 담당
          }
        },
      },
    },
  );
}

/** 현재 요청의 사용자. 없으면 null. */
export async function getUser(sb: SupabaseClient): Promise<User | null> {
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
