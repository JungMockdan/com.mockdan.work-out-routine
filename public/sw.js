/* 모꾸 교정운동 service worker
 * - 앱 셸(정적 자산)·manifest는 cache-first
 * - 페이지 내비게이션은 network-first, 실패 시 캐시 → 오프라인 페이지
 * - /api/ 요청은 캐시하지 않는다(엔진 결과는 앱이 localStorage/DB에 저장)
 * - 응답이 ok일 때만 캐시하고, 페이지 캐시는 최근 30개로 제한한다
 */
const VERSION = 'v2';
const SHELL_CACHE = 'moccu-shell-' + VERSION;
const PAGE_CACHE = 'moccu-pages-' + VERSION;
const OFFLINE_URL = '/offline';
const PAGE_CACHE_LIMIT = 30;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then(async (c) => {
        // 오프라인 폴백은 필수 — 실패하면 install 자체를 실패시켜 재시도되게 한다
        await c.add(OFFLINE_URL);
        // 부가 자산은 실패해도 무방
        await c.addAll(['/manifest.webmanifest', '/icons/icon-192.png']).catch(() => undefined);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('moccu-') && !k.endsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function putPage(req, res) {
  if (!res.ok) return;
  const copy = res.clone();
  caches
    .open(PAGE_CACHE)
    .then(async (c) => {
      await c.put(req, copy);
      const keys = await c.keys();
      for (let i = 0; i < keys.length - PAGE_CACHE_LIMIT; i++) {
        const k = keys[i];
        if (new URL(k.url).pathname !== OFFLINE_URL) await c.delete(k);
      }
    })
    .catch(() => undefined);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          putPage(req, res);
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match(OFFLINE_URL))
            .then((r) => r || Response.error()),
        ),
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            }
            return res;
          }),
      ),
    );
  }
});
