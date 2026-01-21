// ===== SERVICE WORKER MANAGER =====
// Загружаем менеджер Service Worker
const swScript = document.createElement('script');
swScript.src = '/sw-manager.js';
swScript.async = true;
document.head.appendChild(swScript);

// ===== КОНФИГУРАЦИЯ API =====
// Данные берутся из переменных окружения на Render.com
const CONFIG = {
    GIST_ID: 'c37ece5d8832c31be098e4d39e8cb328', // Ваш Gist ID
    FILE_NAME: 'data.json'
};

const API_BASE = window.location.origin;

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let appData = {
    teams: [],
    standings: [],
    matches: [],
    news: [],
    pendingRegistrations: []
};

let userTeam = localStorage.getItem('userTeam');

// ===== ОСНОВНЫЕ ФУНКЦИИ =====
async function loadData() {
    try {
        const response = await fetch(`${API_BASE}/api/data`);
        if (!response.ok) throw new Error('Ошибка загрузки данных');
        
        const data = await response.json();
        appData = data;
        updateUI();
        
        // Проверяем, есть ли элементы на странице
        const alreadyRegisteredBtn = document.getElementById('alreadyRegisteredBtn');
        const registrationForm = document.getElementById('registrationForm');
        
        if (alreadyRegisteredBtn && registrationForm && userTeam && data.standings.find(t => t.team === userTeam)) {
            alreadyRegisteredBtn.style.display = 'block';
            registrationForm.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось загрузить данные. Попробуйте позже.', 'error');
    }
}

function updateUI() {
    // Обновляем только те элементы, которые есть на странице
    if (document.querySelector('#standingsTable tbody')) {
        updateStandingsTable();
    }
    
    if (document.getElementById('upcomingMatches') || 
        document.getElementById('liveMatches') || 
        document.getElementById('finishedMatches')) {
        updateMatches();
    }
    
    if (document.getElementById('newsContainer')) {
        updateNews();
    }
}

function updateStandingsTable() {
    const tbody = document.querySelector('#standingsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    appData.standings.sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
    
    appData.standings.forEach((team, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${team.team}</strong><br><small>${team.owner}</small></td>
            <td>${team.played}</td>
            <td>${team.wins}</td>
            <td>${team.draws}</td>
            <td>${team.losses}</td>
            <td>${team.goalsFor}</td>
            <td>${team.goalsAgainst}</td>
            <td>${team.goalsFor - team.goalsAgainst}</td>
            <td><strong>${team.points}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

function updateMatches() {
    const now = new Date();
    
    // Предстоящие матчи
    const upcomingMatches = document.getElementById('upcomingMatches');
    if (upcomingMatches) {
        const upcoming = appData.matches.filter(m => new Date(m.date) > now && m.status === 'scheduled');
        upcomingMatches.innerHTML = upcoming.map(match => `
            <div class="match-card">
                <div class="match-teams">
                    <span class="team">${match.homeTeam}</span>
                    <span class="match-score">VS</span>
                    <span class="team">${match.awayTeam}</span>
                </div>
                <div class="match-info">
                    <div class="match-date">${formatDate(match.date)}</div>
                    <div class="match-time">${match.time || 'Время уточняется'}</div>
                </div>
            </div>
        `).join('') || '<p>Нет запланированных матчей</p>';
    }
    
    // LIVE матчи
    const liveMatches = document.getElementById('liveMatches');
    if (liveMatches) {
        const live = appData.matches.filter(m => m.status === 'live');
        liveMatches.innerHTML = live.map(match => `
            <div class="match-card live">
                <div class="match-teams">
                    <span class="team">${match.homeTeam}</span>
                    <span class="match-score">${match.homeScore || 0} : ${match.awayScore || 0}</span>
                    <span class="team">${match.awayTeam}</span>
                </div>
                <div class="match-info">
                    <div class="match-status" style="color: var(--accent);">● LIVE</div>
                    <div class="match-minute">${match.minute || '1'}'</div>
                </div>
            </div>
        `).join('') || '<p>Нет матчей в прямом эфире</p>';
    }
    
    // Завершенные матчи
    const finishedMatches = document.getElementById('finishedMatches');
    if (finishedMatches) {
        const finished = appData.matches.filter(m => m.status === 'finished' || new Date(m.date) < now);
        finishedMatches.innerHTML = finished.map(match => `
            <div class="match-card">
                <div class="match-teams">
                    <span class="team">${match.homeTeam}</span>
                    <span class="match-score">${match.homeScore || 0} : ${match.awayScore || 0}</span>
                    <span class="team">${match.awayTeam}</span>
                </div>
                <div class="match-info">
                    <div class="match-date">${formatDate(match.date)}</div>
                    <div class="match-result">${getMatchResult(match)}</div>
                </div>
            </div>
        `).join('') || '<p>Нет завершенных матчей</p>';
    }
}

function updateNews() {
    const newsContainer = document.getElementById('newsContainer');
    if (!newsContainer) return;
    
    newsContainer.innerHTML = appData.news.slice(0, 6).map(item => `
        <div class="news-card">
            <div class="news-date">${formatDate(item.date)}</div>
            <h3>${item.title}</h3>
            <p>${item.content}</p>
            ${item.image ? `<img src="${item.image}" alt="${item.title}" style="width:100%; border-radius:10px; margin-top:1rem;">` : ''}
        </div>
    `).join('');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function getMatchResult(match) {
    if (match.homeScore > match.awayScore) return 'Победа хозяев';
    if (match.homeScore < match.awayScore) return 'Победа гостей';
    return 'Ничья';
}

// ===== РЕГИСТРАЦИЯ КОМАНДЫ =====
async function registerTeam() {
    const teamName = document.getElementById('teamName')?.value.trim();
    const ownerName = document.getElementById('ownerName')?.value.trim();
    
    if (!teamName || !ownerName) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (appData.standings.some(t => t.team === teamName)) {
        showNotification('Команда с таким названием уже существует', 'error');
        return;
    }
    
    const registration = {
        id: Date.now(),
        team: teamName,
        owner: ownerName,
        date: new Date().toISOString(),
        status: 'pending'
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registration)
        });
        
        if (response.ok) {
            showNotification('Заявка отправлена! Ожидайте подтверждения администратора.', 'success');
            
            const teamNameInput = document.getElementById('teamName');
            const ownerNameInput = document.getElementById('ownerName');
            if (teamNameInput) teamNameInput.value = '';
            if (ownerNameInput) ownerNameInput.value = '';
            
            setTimeout(loadData, 2000);
        } else {
            throw new Error('Ошибка отправки');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка отправки заявки', 'error');
    }
}

function showRegisteredMenu() {
    alert(`Ваша команда: ${userTeam}\n\nМеню игрока появится здесь после подтверждения администратора.`);
}

// ===== УТИЛИТЫ =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        border-radius: 10px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function showTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabBtns.length === 0 || tabContents.length === 0) return;
    
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(tabName.charAt(0).toUpperCase() + tabName.slice(1))) {
            btn.classList.add('active');
        }
    });
    
    tabContents.forEach(content => {
        content.style.display = 'none';
    });
    
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
}

// ===== PWA УСТАНОВКА =====
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

if (installBtn) {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'block';
        
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            installBtn.style.display = 'none';
            deferredPrompt.prompt();
            
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Пользователь ${outcome} установку`);
            deferredPrompt = null;
        });
    });

    window.addEventListener('appinstalled', () => {
        console.log('Приложение успешно установлено');
        if (installBtn) installBtn.style.display = 'none';
        deferredPrompt = null;
    });

    // Скрываем кнопку, если приложение уже установлено
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        installBtn.style.display = 'none';
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, страница:', window.location.pathname);
    
    // Мобильное меню (только если есть элементы)
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
    
    // Плавная навигация (только для якорных ссылок на текущей странице)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            e.preventDefault();
            
            if (targetId === '#home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
            
            // Закрываем мобильное меню
            if (navLinks) navLinks.classList.remove('active');
        });
    });
    
    // Загружаем данные
    loadData();
    
    // Автообновление каждые 30 секунд
    setInterval(loadData, 30000);
});

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js?v=5')
        .then(() => console.log('Service Worker зарегистрирован'))
        .catch(err => console.log('Ошибка регистрации SW:', err));
}

// Экспортируем функции для использования в HTML
window.registerTeam = registerTeam;
window.showRegisteredMenu = showRegisteredMenu;
window.showTab = showTab;

// Регистрация команды (уже есть в main.js, но сделаем её глобальной)
window.registerTeam = async function() {
    const teamName = document.getElementById('teamName')?.value.trim();
    const ownerName = document.getElementById('ownerName')?.value.trim();
    
    if (!teamName || !ownerName) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (appData.standings.some(t => t.team === teamName)) {
        showNotification('Команда с таким названием уже существует', 'error');
        return;
    }
    
    const registration = {
        id: Date.now(),
        team: teamName,
        owner: ownerName,
        date: new Date().toISOString(),
        status: 'pending'
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registration)
        });
        
        if (response.ok) {
            showNotification('Заявка отправлена! Ожидайте подтверждения администратора.', 'success');
            const teamNameInput = document.getElementById('teamName');
            const ownerNameInput = document.getElementById('ownerName');
            if (teamNameInput) teamNameInput.value = '';
            if (ownerNameInput) ownerNameInput.value = '';
            setTimeout(loadData, 2000);
        } else {
            throw new Error('Ошибка отправки');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка отправки заявки', 'error');
    }
};

// Вход в систему (новая функция)
window.loginTeam = async function() {
    const teamName = document.getElementById('teamName')?.value.trim() || 
                     document.getElementById('loginTeam')?.value.trim();
    const ownerName = document.getElementById('ownerName')?.value.trim() || 
                      document.getElementById('loginOwner')?.value.trim();
    
    if (!teamName || !ownerName) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/data`);
        const data = await response.json();
        
        const existingTeam = data.standings?.find(t => 
            t.team.toLowerCase() === teamName.toLowerCase() && 
            t.owner.toLowerCase() === ownerName.toLowerCase()
        );
        
        if (existingTeam) {
            localStorage.setItem('liga_userTeam', teamName);
            localStorage.setItem('liga_userOwner', ownerName);
            window.location.href = 'table.html';
        } else {
            showNotification('Команда не найдена. Проверьте данные.', 'error');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        showNotification('Ошибка сервера', 'error');
    }
};

// Показать зарегистрированное меню
window.showRegisteredMenu = function() {
    const userTeam = localStorage.getItem('liga_userTeam');
    alert(`Ваша команда: ${userTeam}\n\nМеню игрока появится здесь после подтверждения администратора.`);
};

// Переключение вкладок
window.showTab = function(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (tabBtns.length === 0 || tabContents.length === 0) return;
    
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(tabName.charAt(0).toUpperCase() + tabName.slice(1))) {
            btn.classList.add('active');
        }
    });
    
    tabContents.forEach(content => {
        content.style.display = 'none';
    });
    
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
};

// Auth tabs (для index.html)
window.showAuthTab = function(tabName) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    forms.forEach(form => form.classList.remove('active'));
    
    if (tabName === 'login') {
        document.querySelector('.auth-tab:nth-child(1)')?.classList.add('active');
        document.getElementById('loginForm')?.classList.add('active');
    } else {
        document.querySelector('.auth-tab:nth-child(2)')?.classList.add('active');
        document.getElementById('registerForm')?.classList.add('active');
    }
};
