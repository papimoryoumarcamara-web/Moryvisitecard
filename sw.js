/* =====================================================================
   SERVICE WORKER — stratégie « cache d'abord » (cache-first)
   Au premier chargement en ligne, tous les fichiers sont mis en cache :
   ensuite l'appli s'ouvre et fonctionne entièrement sans internet.
   >>> Après chaque modification publiée, augmenter VERSION (ex. v2). <<<
   ===================================================================== */
const VERSION = "carte-moc-v2";

const FICHIERS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/data.js",
  "./js/vcard.js",
  "./js/lib/qrcode.js",
  "./js/lib/jsQR.js",
  "./fonts/outfit.woff2",
  "./fonts/worksans.woff2",
  "./assets/photo.jpg",
  "./assets/photo-vcf.jpg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-64.png"
];

/* Installation : on télécharge tout une seule fois */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(FICHIERS)).then(() => self.skipWaiting())
  );
});

/* Activation : on supprime les anciennes versions du cache */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

/* Requêtes : cache d'abord, réseau ensuite (et mise en cache au passage) */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jamais de ressource externe

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((enCache) => {
      if (enCache) return enCache;
      return fetch(req).then((rep) => {
        if (rep && rep.ok && rep.type === "basic") {
          const copie = rep.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copie));
        }
        return rep;
      }).catch(() => {
        // Hors ligne et page inconnue : on renvoie l'appli
        if (req.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "Hors ligne" });
      });
    })
  );
});
