/* 离线缓存：应用本身完全静态，所以缓存优先即可。
   改动前端文件后，把 CACHE 的版本号 +1 就能让所有设备换到新版本。 */
var CACHE = 'mozhang-v2';

var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './icons.js',
  './manifest.json',
  './fonts/Geist-400.woff2',
  './fonts/Geist-500.woff2',
  './fonts/Geist-600.woff2',
  './fonts/GeistMono-500.woff2',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  // 记账数据只走 localStorage，这里只处理静态资源
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (resp) {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      }).catch(function () {
        // 只有页面导航才回退到首页；脚本、字体拿不到就该老老实实失败，
        // 否则浏览器会把一段 HTML 当 JS 或字体去解析。
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
