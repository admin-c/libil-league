// ===== КОНФИГУРАЦИЯ КЭША =====
const CACHE_VERSION = 'liga-v6';
const CACHE_NAME = `${CACHE_VERSION}-${Date.now()}`; // Уникальное имя для принудительного обновления

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

// ===== УСТАНОВКА SERVICE WORKER =====
self.addEventListener('install', event => {
  console.log(`[SW ${CACHE_VERSION}] Установка`);
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        console.log(`[SW] Кэширование ${STATIC_ASSETS.length} файлов`);
        
        // Кэшируем основные файлы
        await cache.addAll(STATIC_ASSETS);
        console.log('[SW] Все файлы закэшированы');
        
        // Активируем сразу
        await self.skipWaiting();
        console.log('[SW] Активирован');
      } catch (error) {
        console.error('[SW] Ошибка при установке:', error);
      }
    })()
  );
});

// ===== АКТИВАЦИЯ И ОЧИСТКА СТАРЫХ КЭШЕЙ =====
self.addEventListener('activate', event => {
  console.log(`[SW ${CACHE_VERSION}] Активация`);
  
  event.waitUntil(
    (async () => {
      try {
        // Получаем все имена кэшей
        const cacheNames = await caches.keys();
        console.log('[SW] Найдены кэши:', cacheNames);
        
        // Удаляем все старые кэши, кроме текущего
        const deletePromises = cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('liga-')) {
            console.log(`[SW] Удаляю старый кэш: ${cacheName}`);
            return caches.delete(cacheName);
          }
        });
        
        await Promise.all(deletePromises);
        console.log('[SW] Старые кэши удалены');
        
        // Берём управление над всеми вкладками
        await self.clients.claim();
        console.log('[SW] Контроль над клиентами установлен');
        
        // Отправляем сообщение всем вкладкам
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION,
            timestamp: Date.now()
          });
        });
        
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
  
  // Пропускаем неподдерживаемые схемы
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Игнорируем API запросы и внешние ресурсы
  if (url.pathname.startsWith('/api/') || 
      url.hostname.includes('github.com') ||
      url.hostname.includes('unsplash.com') ||
      url.hostname.includes('icons8.com')) {
    return fetch(request);
  }
  
  // Для HTML страниц - стратегия "Network first, then cache"
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Для статических ресурсов - стратегия "Cache first"
  if (request.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Для остального - пробуем сеть, потом кэш
  event.respondWith(networkFirst(request));
});

// ===== СТРАТЕГИИ КЭШИРОВАНИЯ =====

// Стратегия "Network First" - сначала сеть, потом кэш
async function networkFirst(request) {
  try {
    // Пытаемся получить из сети
    const networkResponse = await fetch(request);
    
    // Клонируем ответ для кэширования
    const responseClone = networkResponse.clone();
    
    // Кэшируем успешные ответы
    if (networkResponse.ok && networkResponse.status === 200) {
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, responseClone);
      });
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('[SW] Ошибка сети, пытаюсь кэш:', request.url);
    
    // Если сеть не доступна, ищем в кэше
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Для HTML страниц возвращаем заглушку
    if (request.headers.get('Accept')?.includes('text/html')) {
      return caches.match('/index.html');
    }
    
    // Возвращаем стандартный ответ об ошибке
    return new Response('Нет соединения', {
      status: 503,
      statusText: 'Нет соединения с интернетом',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Стратегия "Cache First" - сначала кэш, потом сеть
async function cacheFirst(request) {
  try {
    // Пытаемся получить из кэша
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Если нет в кэше, загружаем из сети
    const networkResponse = await fetch(request);
    
    // Кэшируем для будущего использования
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, responseClone);
      });
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Ошибка:', error);
    
    // Возвращаем заглушку для CSS/JS
    if (request.url.endsWith('.css')) {
      return new Response('/* Файл стилей временно недоступен */', {
        headers: { 'Content-Type': 'text/css' }
      });
    }
    
    if (request.url.endsWith('.js')) {
      return new Response('// Файл скрипта временно недоступен', {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
    
    return new Response('Ресурс недоступен', { status: 503 });
  }
}

// ===== ОБРАБОТКА СООБЩЕНИЙ =====
self.addEventListener('message', event => {
  console.log('[SW] Получено сообщение:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'CLEAR_CACHE':
      clearCache();
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.ports[0].postMessage(info);
      });
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Очистка кэша
async function clearCache() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map(name => caches.delete(name));
    await Promise.all(deletePromises);
    console.log('[SW] Все кэши очищены');
  } catch (error) {
    console.error('[SW] Ошибка при очистке кэша:', error);
  }
}

// Получение информации о кэше
async function getCacheInfo() {
  try {
    const cacheNames = await caches.keys();
    const cacheInfos = [];
    
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      cacheInfos.push({
        name,
        size: requests.length,
        urls: requests.map(req => req.url)
      });
    }
    
    return {
      version: CACHE_VERSION,
      currentCache: CACHE_NAME,
      allCaches: cacheInfos
    };
    
  } catch (error) {
    console.error('[SW] Ошибка при получении информации:', error);
    return { error: error.message };
  }
}

// ===== ФОНОВЫЕ ЗАДАЧИ =====
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

// Фоновая задача обновления кэша
async function updateCache() {
  console.log('[SW] Фоновое обновление кэша');
  
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Обновляем основные страницы
    const urlsToUpdate = STATIC_ASSETS;
    
    for (const url of urlsToUpdate) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log(`[SW] Обновлен: ${url}`);
        }
      } catch (error) {
        console.log(`[SW] Не удалось обновить ${url}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('[SW] Ошибка при обновлении кэша:', error);
  }
}

// ===== ОБРАБОТКА ОШИБОК =====
self.addEventListener('error', error => {
  console.error('[SW] Ошибка:', error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Необработанное исключение:', event.reason);
});
