import { defineConfig, devices } from '@playwright/test';

/**
 * E2E: 모바일 뷰포트(iPhone 13)로 온보딩→실행→완료 흐름을 검증하고
 * docs/screenshots/ 에 스크린샷을 남긴다.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium', // WebKit 미설치 환경 대비. iOS 검증은 실기기로.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  webServer: {
    command: 'npm run build && npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
    // 이 스위트는 localStorage 저장소를 직접 읽고 쓰는 전제로 짜여 있다.
    // .env.local에 Supabase 키가 있으면 앱이 Supabase 모드로 빌드돼 전부 실패하므로
    // 빌드 시점에 키를 비워 로컬 모드로 고정한다. (NEXT_PUBLIC_* 은 빌드 타임 인라인)
    // Supabase 모드 검증은 E2E_SUPABASE=1 로 켜되, 익명 로그인·스키마가 준비돼야 하고
    // localStorage를 직접 만지는 단정은 통과하지 않는다 — 수동 확인용이다.
    env:
      process.env.E2E_SUPABASE === '1'
        ? {}
        : { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' },
  },
});
