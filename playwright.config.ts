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
    command: 'npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
