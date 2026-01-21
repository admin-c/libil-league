// ===== МЕНЕДЖЕР SERVICE WORKER =====
class ServiceWorkerManager {
  constructor() {
    this.registration = null;
    this.version = 'v6';
    this.isUpdateAvailable = false;
  }
  
  // Инициализация
  async init() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker не поддерживается');
      return false;
    }
    
    try {
      // Регистрируем Service Worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Отключаем кэширование SW
      });
      
      console.log(`Service Worker зарегистрирован: ${this.version}`);
      
      // Слушаем сообщения от Service Worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));
      
      // Проверяем обновления
      this.checkForUpdates();
      
      // Периодическая проверка обновлений (каждые 5 минут)
      setInterval(() => this.checkForUpdates(), 5 * 60 * 1000);
      
      return true;
      
    } catch (error) {
      console.error('Ошибка регистрации Service Worker:', error);
      return false;
    }
  }
  
  // Обработка сообщений от Service Worker
  handleMessage(event) {
    const { type, version, timestamp } = event.data;
    
    switch (type) {
      case 'SW_UPDATED':
        console.log(`Service Worker обновлен до версии ${version}`);
        this.showUpdateNotification();
        break;
        
      case 'CACHE_UPDATED':
        console.log('Кэш обновлен');
        break;
    }
  }
  
  // Проверка обновлений
  async checkForUpdates() {
    if (!this.registration) return;
    
    try {
      await this.registration.update();
      console.log('Проверка обновлений выполнена');
    } catch (error) {
      console.log('Ошибка при проверке обновлений:', error);
    }
  }
  
  // Показать уведомление об обновлении
  showUpdateNotification() {
    if (this.isUpdateAvailable) return;
    
    this.isUpdateAvailable = true;
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.id = 'sw-update-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3b82f6;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
      ">
        <span>Доступно обновление!</span>
        <button onclick="window.swManager.reloadPage()" style="
          background: white;
          color: #3b82f6;
          border: none;
          padding: 5px 15px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">
          Обновить
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматически скрыть через 10 секунд
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
        this.isUpdateAvailable = false;
      }
    }, 10000);
  }
  
  // Перезагрузка страницы для применения обновления
  reloadPage() {
    const notification = document.getElementById('sw-update-notification');
    if (notification) notification.remove();
    
    // Принудительная перезагрузка с очисткой кэша
    window.location.reload(true);
  }
  
  // Очистка кэша
  async clearCache() {
    try {
      if (this.registration && this.registration.active) {
        this.registration.active.postMessage({
          type: 'CLEAR_CACHE'
        });
      }
      
      // Очищаем кэши браузера
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      console.log('Кэш очищен');
      return true;
      
    } catch (error) {
      console.error('Ошибка при очистке кэша:', error);
      return false;
    }
  }
  
  // Получить информацию о кэше
  async getCacheInfo() {
    return new Promise((resolve) => {
      if (!this.registration || !this.registration.active) {
        resolve({ error: 'Service Worker не активен' });
        return;
      }
      
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      this.registration.active.postMessage({
        type: 'GET_CACHE_INFO'
      }, [channel.port2]);
    });
  }
}

// Создаем глобальный экземпляр менеджера
window.swManager = new ServiceWorkerManager();

// Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  window.swManager.init().then(success => {
    if (success) {
      console.log('Service Worker Manager инициализирован');
    }
  });
});
