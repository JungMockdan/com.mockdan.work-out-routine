import type { Page } from '@playwright/test';

/**
 * 유튜브 썸네일(i.ytimg.com)을 고정 1×1 이미지로 가로챈다.
 *
 * 왜 필요한가 — e2e가 docs/screenshots/에 fullPage PNG를 찍고 그게 커밋된다.
 * 외부 CDN 이미지가 그대로 들어오면 매 실행마다 바이트가 흔들려 스크린샷이
 * 영구히 비결정적이 되고, 네트워크가 없으면 테스트가 깨진다.
 * e2e는 유튜브 CDN을 검증할 이유가 없으므로 격리하는 편이 정직하다.
 *
 * NEXT_PUBLIC_* 플래그로는 못 막는다 — 빌드 타임 인라인이고
 * playwright.config.ts는 런 전체에 대해 한 번만 빌드한다.
 *
 * 확장자가 .jpg여도 content-type이 우선하므로 PNG로 응답해도 된다.
 */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export async function stubYouTubeThumbs(page: Page): Promise<void> {
  await page.route('**://i.ytimg.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG }),
  );
}
