// Rock Road Film Shelf service worker.
// On install it saves EVERYTHING needed offline: the page, icons, fonts and every poster.
// Page: network-first with a 3s timeout (so updates show, bad signal doesn't hang). Everything else: cache-first.
const V = "rrfs-v2";
const CORE = ["./", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/favicon.png"];
const MATCH = { ignoreVary: true, ignoreSearch: false };

async function saveAll() {
  const c = await caches.open(V);
  await c.addAll(CORE);                                   // must succeed
  const html = await (await c.match("./")).text();
  const posters = [...new Set(html.match(/https:\/\/(?:upload|thumb)\.wikimedia\.org\/[^"'\s<>]+/g) || [])];
  const fontCss = (html.match(/https:\/\/fonts\.googleapis\.com\/css2[^"'\s<>]+/) || [])[0];
  const jobs = posters.map(u => fetch(u, { mode: "cors" }).then(r => r.ok && c.put(u, r)));
  if (fontCss) jobs.push((async () => {
    const css = fontCss.replace(/&amp;/g, "&"), r = await fetch(css, { mode: "cors" });
    const text = await r.clone().text(); await c.put(css, r);
    const files = text.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || [];
    await Promise.allSettled(files.map(f => fetch(f, { mode: "cors" }).then(x => x.ok && c.put(f, x))));
  })());
  await Promise.allSettled(jobs);                         // a missing poster never blocks install
}

self.addEventListener("install", e => { e.waitUntil(saveAll()); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  if (r.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const res = await Promise.race([fetch(r), new Promise((_, no) => setTimeout(() => no("slow"), 3000))]);
        if (res.ok) c.put("./", res.clone());
        return res;
      } catch { return (await c.match("./")) || Response.error(); }
    })());
    return;
  }
  const u = new URL(r.url);
  const ok = u.origin === location.origin || /(^|\.)wikimedia\.org$/.test(u.hostname) || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!ok) return;
  e.respondWith(caches.match(r, MATCH).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); }
    return res;
  })));
});
