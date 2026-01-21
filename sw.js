// ===== КОНФИГУРАЦИЯ КЭША =====
const CACHE_VERSION = 'liga-v7';
const CACHE_NAME = `${CACHE_VERSION}-${Date.now()}`;

// Статические ресурсы для кэширования
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/table.html', 
  '/fixtures.html',
  '/news.html',
  '/admin.html',
  '/style.css',
  '/main.js',
  '/admin.js',
  '/manifest.json',
  '/clearcache.html'
];

// ===== УСТАНОВКА =====
self.addEventListener('install', event => {
  console.log(`[SW ${CACHE_VERSION}] Установка`);
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log(`[SW] Кэширование ${STATIC_ASSETS.length} файлов`);
        
        // Кэшируем с обработкой ошибок
        for (const url of STATIC_ASSETS) {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn(`[SW] Не удалось закэшировать ${url}:`, err.message);
          }
        }
        
        console.log('[SW] Все файлы закэшированы');
        await self.skipWaiting();
        
      } catch (error) {
        console.error('[SW] Ошибка при установке:', error);
      }
    })()
  );
});

// ===== АКТИВАЦИЯ =====
self.addEventListener('activate', event => {
  console.log(`[SW ${CACHE_VERSION}] Активация`);
  
  event.waitUntil(
    (async () => {
      try {
        // Очищаем старые кэши
        const cacheNames = await caches.keys();
        const deletions = cacheNames
          .filter(name => name.startsWith('liga-') && name !== CACHE_NAME)
          .map(name => {
            console.log(`[SW] Удаляю старый кэш: ${name}`);
            return caches.delete(name);
          });
        
        await Promise.all(deletions);
        await self.clients.claim();
        
        console.log('[SW] Активация завершена');
        
      } catch (error) {
        console.error('[SW] Ошибка при активации:', error);
      }
    })()
  );
});

// ===== ОБРАБОТКА ЗАПРОСОВ =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ВАЖНО: НИКОГДА не перехватываем API запросы!
  if (url.pathname.startsWith('/api/')) {
    // Полностью пропускаем API запросы
    return;
  }
  
  // Игнорируем POST, PUT, DELETE запросы
  if (request.method !== 'GET') {
    return;
  }
  
  // Игнорируем внешние ресурсы
  if (!url.href.startsWith(self.location.origin)) {
    return;
  }
  
  // Для HTML страниц - стратегия "Network first"
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(handleHtmlRequest(request));
    return;
  }
  
  // Для статики - стратегия "Cache first"
  if (request.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/)) {
    event.respondWith(handleStaticRequest(request));
  }
});

// ===== СТРАТЕГИИ =====

// Обработка HTML запросов
async function handleHtmlRequest(request) {
  try {
    // Сначала пробуем сеть
    const networkResponse = await fetch(request);
    
    // Если успешно, кэшируем
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Если сеть не доступна, пробуем кэш
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Возвращаем страницу 404 или главную
    return caches.match('/index.html') || 
           new Response('Страница не найдена', { status: 404 });
  }
}

// Обработка статических файлов
async function handleStaticRequest(request) {
  // Сначала пробуем кэш
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Если нет в кэше, загружаем из сети
    const networkResponse = await fetch(request);
    
    // Кэшируем для будущего использования
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Если файл не загрузился, возвращаем заглушку
    const url = new URL(request.url);
    
    if (url.pathname.endsWith('.css')) {
      return new Response('/* CSS временно недоступен */', {
        headers: { 'Content-Type': 'text/css' }
      });
    }
    
    if (url.pathname.endsWith('.js')) {
      return new Response('// JS временно недоступен', {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
    
    return new Response('Ресурс недоступен', { status: 503 });
  }
}

// ===== ПРОСТОЙ КОД БЕЗ СЛОЖНОЙ ЛОГИКИ =====
self.addEventListener('message', event => {
  const { type } = event.data;
  
  if (type === 'CLEAR_CACHE') {
    clearCache();
  } else if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function clearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[SW] Все кэши очищены');
  } catch (error) {
    console.error('[SW] Ошибка очистки кэша:', error);
  }
}
