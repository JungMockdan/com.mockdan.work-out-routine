import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase 세션 토큰 갱신 (키가 설정된 경우에만 동작).
 * 만료된 토큰을 가진 요청이 라우트 핸들러에 닿기 전에 갱신해 쿠키를 다시 심는다.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next(); // localStorage 모드 — 아무것도 안 함

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser(); // 토큰 갱신 트리거
  return response;
}

export const config = {
  // API와 페이지만 — 정적 자산 제외
  matcher: ['/((?!_next/static|_next/image|icons|sw\\.js|manifest\\.webmanifest|favicon\\.ico).*)'],
};
