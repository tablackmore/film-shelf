// Film Shelf service worker: page network-first (so updates show), assets & posters cache-first (offline).
const V = "film-shelf-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(V).then(x => x.put("./", c)); return res; })
      .catch(() => caches.match("./")));
    return;
  }
  const u = new URL(r.url);
  const cacheable = u.origin === location.origin || /(^|\.)wikimedia\.org$/.test(u.hostname) || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!cacheable) return;
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === "opaque") { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); }
    return res;
  })));
});
