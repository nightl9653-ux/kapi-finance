/* global self, caches, Response */
/**
 * PWA：接收系统「分享」到应用的图片（POST /zh/share-target 或 /en/share-target），
 * 写入 Cache Storage 后重定向到快捷记账页。
 * 需与 QuickRecordClient 中的 SHARE_CACHE / 路径保持一致。
 */
const SHARE_CACHE = "pwa-share-v1";
const PENDING_PATH = "/__shared_image_pending";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST") return;

  const isShareTarget =
    url.pathname === "/zh/share-target" || url.pathname === "/en/share-target";

  if (!isShareTarget) return;

  event.respondWith(
    (async () => {
      const locale = url.pathname.startsWith("/zh") ? "zh" : "en";
      try {
        const formData = await event.request.formData();
        let file = null;
        for (const [, v] of formData.entries()) {
          if (v instanceof File && v.type.startsWith("image/") && v.size > 0) {
            file = v;
            break;
          }
        }
        if (!file) {
          return Response.redirect(new URL(`/${locale}/quick-record?error=bad_file`, url.origin), 303);
        }
        const cache = await caches.open(SHARE_CACHE);
        const pending = new Request(new URL(PENDING_PATH, url.origin).toString());
        await cache.put(
          pending,
          new Response(file, {
            headers: { "Content-Type": file.type || "image/jpeg" },
          }),
        );
        return Response.redirect(new URL(`/${locale}/quick-record?shared=1`, url.origin), 303);
      } catch {
        return Response.redirect(new URL(`/${locale}/quick-record?error=unknown`, url.origin), 303);
      }
    })(),
  );
});
