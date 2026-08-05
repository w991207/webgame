// 라스트 존 - 서비스 워커
// PWA 설치 가능 요건(manifest + fetch 핸들러가 있는 service worker)을 충족시키기 위한 용도.
// 정적 리소스는 방문 시점에 캐시해두고, 다음 요청부터는 네트워크 우선 + 실패 시 캐시로 대체한다.
// (patch.json 등 실시간으로 바뀌어야 하는 파일은 네트워크가 살아있으면 항상 최신을 받는다)

const CACHE_NAME = 'lastzone-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
