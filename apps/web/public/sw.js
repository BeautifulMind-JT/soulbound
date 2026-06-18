const CACHE_VERSION = "soulbound-prealpha-v1";
const ASSET_CACHE = `${CACHE_VERSION}:assets`;
const SHELL_CACHE = `${CACHE_VERSION}:shell`;
const PUBLIC_SHELL_PATHS = ["/", "/login", "/signup"];
const PRIVATE_PATH_PATTERNS = [
  /^\/api(?:\/|$)/,
  /persona-clip/i,
  /\/admin(?:\/|$)/,
  /\/apply(?:\/|$)/,
  /\/gate(?:\/|$)/,
  /\/member(?:\/|$)/,
];

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function shouldBypassCache(request) {
  if (request.method !== "GET") {
    return true;
  }
  const url = new URL(request.url);
  if (!sameOrigin(url)) {
    return true;
  }
  if (request.headers.has("authorization")) {
    return true;
  }
  if ((request.headers.get("cache-control") || "").includes("no-store")) {
    return true;
  }
  return PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function isCacheablePublicAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PUBLIC_SHELL_PATHS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldBypassCache(request)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (isCacheablePublicAsset(url.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  if (PUBLIC_SHELL_PATHS.includes(url.pathname)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          throw error;
        }
      }),
    );
  }
});
