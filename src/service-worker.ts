/// <reference lib="webworker" />
export {};
declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE_ASSETS__: string[];
const cacheName = "doku-" + __BUILD_ID__;
const clientBuilds = new Map<string, string>();
async function retireUnused() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  // A sleeping or newly opened page has not attested its build. Keep its assets.
  if (clients.some((client) => !clientBuilds.has(client.id))) return;
  const keep = new Set([
    cacheName,
    ...clients.map((client) => "doku-" + clientBuilds.get(client.id)),
  ]);
  for (const name of await caches.keys())
    if (name.startsWith("doku-") && !keep.has(name)) await caches.delete(name);
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      try {
        await cache.addAll(__PRECACHE_ASSETS__);
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      for (const client of await self.clients.matchAll())
        client.postMessage({ type: "REPORT_BUILD" });
      await retireUnused();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE") event.waitUntil(self.skipWaiting());
  if (event.data?.type === "VERSION")
    event.ports[0]?.postMessage({ build: __BUILD_ID__ });
  if (
    event.data?.type === "CLIENT_BUILD" &&
    /^[a-f0-9]{12}$/.test(event.data.build) &&
    event.source &&
    "id" in event.source
  ) {
    clientBuilds.set(event.source.id, event.data.build);
    event.waitUntil(retireUnused());
  }
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/version.json" ||
    url.searchParams.has("update-probe")
  )
    return;
  event.respondWith(
    (async () => {
      const own = await caches.open(cacheName);
      if (request.mode === "navigate")
        return (await own.match("/")) ?? fetch(request);
      return (
        (await own.match(url.pathname)) ??
        (await caches.match(request)) ??
        fetch(request)
      );
    })(),
  );
});
