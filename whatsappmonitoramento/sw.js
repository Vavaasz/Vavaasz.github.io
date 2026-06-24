const CACHE_NAME = "tka-monitoramento-whatsapp-20260624-hosting-quota-fallback";
const APP_SHELL = [
  "/whatsappmonitoramento/app/",
  "/whatsappmonitoramento/app/shift/",
  "/whatsappmonitoramento/mobile/",
  "/whatsappmonitoramento/styles.css",
  "/whatsappmonitoramento/public-bridge-config.js",
  "/whatsappmonitoramento/app.js",
  "/whatsappmonitoramento/manifest.webmanifest",
  "/assets/tka-shield-32.png",
  "/assets/tka-shield-64.png",
  "/assets/tka-shield-180.png",
  "/assets/tka-shield-192.png",
  "/assets/tka-shield-512.png",
  "/whatsappmonitoramento/icons/icon-192.png",
  "/whatsappmonitoramento/icons/icon-512.png"
];
const APP_SHELL_SET = new Set(APP_SHELL);
const NETWORK_FIRST_PATHS = new Set([
  "/whatsappmonitoramento/app/",
  "/whatsappmonitoramento/app/shift/",
  "/whatsappmonitoramento/mobile/",
  "/whatsappmonitoramento/app.js",
  "/whatsappmonitoramento/public-bridge-config.js",
  "/whatsappmonitoramento/sw.js"
]);
const NAVIGATION_FALLBACK = "/whatsappmonitoramento/app/";
const FETCH_TIMEOUT_MS = 3500;

self.addEventListener("install", event => {
  event.waitUntil(
    precacheAppShell()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => reloadMonitoramentoClients())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const isSharedLogo = url.pathname.startsWith("/assets/tka-shield-");
  if (!url.pathname.startsWith("/whatsappmonitoramento/") && !isSharedLogo) return;
  if (url.pathname.endsWith(".zip")) return;

  event.respondWith(shouldUseNetworkFirst(request, url) ? networkFirstShell(request, url) : cacheFirstShell(request, url));
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "TKA_MONITORAMENTO_SKIP_WAITING") self.skipWaiting();
});

function fetchWithTimeout(request, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL.map(async path => {
    const response = await fetchWithTimeout(path, FETCH_TIMEOUT_MS);
    if (response.ok) await cache.put(path, response);
  }));
}

function shellCacheKey(request, url) {
  if (request.mode === "navigate") {
    const route = url.pathname.replace(/\/+$/, "") || "/";
    if (route === "/whatsappmonitoramento/app") return "/whatsappmonitoramento/app/";
    if (route === "/whatsappmonitoramento/app/shift") return "/whatsappmonitoramento/app/shift/";
    if (route === "/whatsappmonitoramento/mobile") return "/whatsappmonitoramento/mobile/";
  }
  if (APP_SHELL_SET.has(url.pathname)) return url.pathname;
  if (url.pathname.startsWith("/assets/tka-shield-")) return url.pathname;
  return "";
}

function shouldUseNetworkFirst(request, url) {
  if (request.mode === "navigate") return true;
  return NETWORK_FIRST_PATHS.has(url.pathname);
}

async function putShellResponse(cache, request, url, response) {
  if (!response || !response.ok) return;
  await cache.put(request, response.clone()).catch(() => {});
  const key = shellCacheKey(request, url);
  if (key && key !== request.url) await cache.put(key, response.clone()).catch(() => {});
}

async function networkFirstShell(request, url) {
  const cache = await caches.open(CACHE_NAME);
  const key = shellCacheKey(request, url);
  try {
    const response = await fetchWithTimeout(request);
    if (!response.ok) throw new Error(`network status ${response.status}`);
    await putShellResponse(cache, request, url, response);
    return response;
  } catch {
    const cached = (await cache.match(request)) || (key ? await cache.match(key) : null);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await cache.match(key || NAVIGATION_FALLBACK) || await cache.match(NAVIGATION_FALLBACK);
      if (fallback) return fallback;
    }
    throw new Error("offline");
  }
}

async function cacheFirstShell(request, url) {
  const cache = await caches.open(CACHE_NAME);
  const key = shellCacheKey(request, url);
  const cached = (await cache.match(request)) || (key ? await cache.match(key) : null);
  const update = fetchWithTimeout(request)
    .then(response => {
      if (!response.ok) throw new Error(`network status ${response.status}`);
      putShellResponse(cache, request, url, response).catch(() => {});
      return response;
    });
  if (cached) {
    update.catch(() => {});
    return cached;
  }
  try {
    return await update;
  } catch {
    if (request.mode === "navigate") {
      const fallback = await cache.match(key || NAVIGATION_FALLBACK) || await cache.match(NAVIGATION_FALLBACK);
      if (fallback) return fallback;
    }
    throw new Error("offline");
  }
}

async function reloadMonitoramentoClients() {
  const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
  await Promise.allSettled(windows.map(client => {
    const url = new URL(client.url);
    if (url.origin !== self.location.origin || !url.pathname.startsWith("/whatsappmonitoramento/")) return null;
    return client.navigate(client.url);
  }));
}
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(windows => {
        const target = windows.find(client => client.url.includes("/whatsappmonitoramento/app/shift/"));
        if (target) return target.focus();
        return clients.openWindow("/whatsappmonitoramento/app/shift/");
      })
  );
});
