// ===== ПРОСТОЙ SERVICE WORKER БЕЗ ПЕРЕХВАТА API =====
const CACHE_VERSION = 'liga-static-v9';
const CACHE_NAME = `${CACHE_VERSION}-${Date.now()}`;

// Только статические файлы для кэширования
const STATIC_FILES = [
  '/',
  '/index.html',
  '/table.html',
  '/fixtures.html',
  '/news.html',
  '/admin.html',
  '/style.css',
  '/main.js',
  '/admin.js',
  '/manifest.json'
];

// ===== УСТАНОВКА =====
self.addEventListener('install', event => {
  console.log(`[SW] Установка версии ${CACHE_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэширование статических файлов');
        return cache.addAll(STATIC_FILES);
      })
      .catch(err => {
        console.warn('[SW] Некоторые файлы не закэшированы:', err);
      })
      .then(() => self.skipWaiting())
  );
});

// ===== АКТИВАЦИЯ =====
self.addEventListener('activate', event => {
  console.log(`[SW] Активация версии ${CACHE_VERSION}`);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('liga-') && name !== CACHE_NAME)
            .map(name => {
              console.log(`[SW] Удаляю старый кэш: ${name}`);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ===== ОБРАБОТКА ЗАПРОСОВ =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ⚠️ ВАЖНО: НИКОГДА не перехватываем API запросы
  if (url.pathname.startsWith('/api/')) {
    // Полностью пропускаем, позволяем браузеру обрабатывать самостоятельно
    return;
  }
  
  // Не перехватываем POST, PUT, DELETE, OPTIONS запросы
  if (request.method !== 'GET') {
    return;
  }
  
  // Не перехватываем запросы к другим доменам
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Для HTML страниц - стратегия Network First
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Кэшируем успешные ответы
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Если сеть недоступна, используем кэш
          return caches.match(request)
            .then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }
  
  // Для статических файлов - стратегия Cache First
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          return cached;
        }
        
        // Если нет в кэше, загружаем из сети
        return fetch(request)
          .then(response => {
            // Кэшируем успешные ответы
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(error => {
            console.warn('[SW] Ошибка загрузки:', request.url, error);
            // Для CSS/JS возвращаем заглушку
            if (request.url.endsWith('.css')) {
              return new Response('/* CSS file */', {
                headers: { 'Content-Type': 'text/css' }
              });
            }
            if (request.url.endsWith('.js')) {
              return new Response('// JS file', {
                headers: { 'Content-Type': 'application/javascript' }
              });
            }
            return new Response('Resource not available', { status: 503 });
          });
      })
  );
});

// ===== ОЧИСТКА КЭША ПО ЗАПРОСУ =====
self.addEventListener('message', event => {
  if (event.data === 'clear-cache') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
      console.log('[SW] Все кэши очищены');
    });
  }
});
