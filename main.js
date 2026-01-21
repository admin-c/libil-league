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
        
        if (userTeam && data.standings.find(t => t.team === userTeam)) {
            document.getElementById('alreadyRegisteredBtn').style.display = 'block';
            document.getElementById('registrationForm').style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось загрузить данные. Попробуйте позже.', 'error');
    }
}

function updateUI() {
    updateStandingsTable();
    updateMatches();
    updateNews();
}

function updateStandingsTable() {
    const tbody = document.querySelector('#standingsTable tbody');
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
    const upcoming = appData.matches.filter(m => new Date(m.date) > now && m.status === 'scheduled');
    document.getElementById('upcomingMatches').innerHTML = upcoming.map(match => `
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
    
    // LIVE матчи
    const live = appData.matches.filter(m => m.status === 'live');
    document.getElementById('liveMatches').innerHTML = live.map(match => `
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
    
    // Завершенные матчи
    const finished = appData.matches.filter(m => m.status === 'finished' || new Date(m.date) < now);
    document.getElementById('finishedMatches').innerHTML = finished.map(match => `
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

function updateNews() {
    document.getElementById('newsContainer').innerHTML = appData.news.slice(0, 6).map(item => `
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
    const teamName = document.getElementById('teamName').value.trim();
    const ownerName = document.getElementById('ownerName').value.trim();
    
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
            document.getElementById('teamName').value = '';
            document.getElementById('ownerName').value = '';
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
        background: ${type === 'error' ? 'var(--accent)' : type === 'success' ? 'var(--success)' : 'var(--secondary)'};
        color: white;
        border-radius: 10px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(tabName.charAt(0).toUpperCase() + tabName.slice(1))) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById(tabName).style.display = 'block';
}

// ===== PWA УСТАНОВКА =====
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
    
    installBtn.addEventListener('click', () => {
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            deferredPrompt = null;
        });
    });
});

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.menu-toggle').addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('active');
    });
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#home') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                document.querySelector(targetId)?.scrollIntoView({ behavior: 'smooth' });
            }
            document.querySelector('.nav-links').classList.remove('active');
        });
    });
    
    loadData();
    setInterval(loadData, 30000);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker зарегистрирован'))
        .catch(err => console.log('Ошибка регистрации SW:', err));
}
