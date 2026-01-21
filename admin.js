// ===== КОНФИГУРАЦИЯ =====
const ADMIN_PASSWORD = "Ali"; // Пароль для доступа
let adminData = {};

// ===== АУТЕНТИФИКАЦИЯ =====
function checkPassword() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        document.getElementById('passwordPrompt').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        loadAdminData();
    } else {
        alert('Неверный пароль!');
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadAdminData() {
    try {
        const response = await fetch('/api/data');
        adminData = await response.json();
        renderAdminPanels();
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        alert('Не удалось загрузить данные');
    }
}

// ===== РЕНДЕРИНГ ПАНЕЛЕЙ =====
function renderAdminPanels() {
    renderPendingRegistrations();
    renderTeamsList();
    renderMatches();
    renderNews();
    renderStandingsEditor();
    populateTeamSelects();
}

// 1. Заявки на регистрацию
function renderPendingRegistrations() {
    const container = document.getElementById('pendingRegistrations');
    if (!adminData.pendingRegistrations || adminData.pendingRegistrations.length === 0) {
        container.innerHTML = '<p>Нет новых заявок</p>';
        return;
    }
    
    container.innerHTML = adminData.pendingRegistrations.map(reg => `
        <div class="list-item">
            <div>
                <strong>${reg.team}</strong><br>
                <small>Владелец: ${reg.owner}</small><br>
                <small>Дата: ${new Date(reg.date).toLocaleDateString()}</small>
            </div>
            <div class="btn-group">
                <button class="admin-btn btn-save" onclick="approveRegistration(${reg.id})">✅ Принять</button>
                <button class="admin-btn btn-delete" onclick="rejectRegistration(${reg.id})">❌ Отклонить</button>
            </div>
        </div>
    `).join('');
}

// 2. Список команд
function renderTeamsList() {
    const container = document.getElementById('teamsList');
    container.innerHTML = adminData.standings.map(team => `
        <div class="list-item">
            <div>
                <strong>${team.team}</strong><br>
                <small>${team.owner}</small>
            </div>
            <div class="btn-group">
                <button class="admin-btn btn-edit" onclick="editTeam('${team.team}')">✏️</button>
                <button class="admin-btn btn-delete" onclick="deleteTeam('${team.team}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// 3. Матчи
function renderMatches() {
    const now = new Date();
    
    // Предстоящие
    const upcoming = adminData.matches.filter(m => m.status === 'scheduled');
    document.getElementById('upcomingMatchesAdmin').innerHTML = upcoming.map(match => `
        <div class="list-item">
            <div>
                <strong>${match.homeTeam} vs ${match.awayTeam}</strong><br>
                <small>${new Date(match.date).toLocaleDateString()} ${match.time || ''}</small>
            </div>
            <div class="match-controls">
                <button class="admin-btn" onclick="startMatch('${match.id}')">▶️ Старт</button>
                <button class="admin-btn btn-edit" onclick="editMatch('${match.id}')">✏️</button>
                <button class="admin-btn btn-delete" onclick="deleteMatch('${match.id}')">🗑️</button>
            </div>
        </div>
    `).join('') || '<p>Нет предстоящих матчей</p>';
    
    // LIVE
    const live = adminData.matches.filter(m => m.status === 'live');
    document.getElementById('liveMatchesAdmin').innerHTML = live.map(match => `
        <div class="list-item">
            <div>
                <strong>${match.homeTeam} ${match.homeScore || 0} : ${match.awayScore || 0} ${match.awayTeam}</strong><br>
                <small>${match.minute || '1'}' минута</small>
            </div>
            <div class="match-live-controls">
                <button class="admin-btn" onclick="updateScore('${match.id}', 'home', 1)">+1 дома</button>
                <button class="admin-btn" onclick="updateScore('${match.id}', 'away', 1)">+1 гости</button>
                <input type="number" class="score-input" id="minute_${match.id}" value="${match.minute || 1}" onchange="updateMinute('${match.id}', this.value)">
                <span>мин.</span>
                <button class="admin-btn btn-save" onclick="finishMatch('${match.id}')">🏁 Завершить</button>
            </div>
        </div>
    `).join('') || '<p>Нет матчей в прямом эфире</p>';
    
    // Завершенные
    const finished = adminData.matches.filter(m => m.status === 'finished');
    document.getElementById('finishedMatchesAdmin').innerHTML = finished.map(match => `
        <div class="list-item">
            <div>
                <strong>${match.homeTeam} ${match.homeScore || 0} : ${match.awayScore || 0} ${match.awayTeam}</strong><br>
                <small>${new Date(match.date).toLocaleDateString()}</small>
            </div>
            <div class="btn-group">
                <button class="admin-btn" onclick="reopenMatch('${match.id}')">↪️ Переиграть</button>
                <button class="admin-btn btn-delete" onclick="deleteMatch('${match.id}')">🗑️</button>
            </div>
        </div>
    `).join('') || '<p>Нет завершенных матчей</p>';
}

// 4. Новости
function renderNews() {
    const container = document.getElementById('newsListAdmin');
    container.innerHTML = adminData.news.map(item => `
        <div class="list-item">
            <div>
                <strong>${item.title}</strong><br>
                <small>${new Date(item.date).toLocaleDateString()}</small>
            </div>
            <div class="btn-group">
                <button class="admin-btn btn-delete" onclick="deleteNews('${item.id}')">🗑️ Удалить</button>
            </div>
        </div>
    `).join('');
}

// 5. Редактор таблицы
function renderStandingsEditor() {
    const container = document.getElementById('standingsEditor');
    container.innerHTML = adminData.standings.map(team => `
        <div class="list-item">
            <div style="flex-grow: 1;">
                <strong>${team.team}</strong><br>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; margin-top: 0.5rem;">
                    <div><small>И: <input type="number" value="${team.played}" class="score-input" onchange="updateTeamStat('${team.team}', 'played', this.value)"></small></div>
                    <div><small>В: <input type="number" value="${team.wins}" class="score-input" onchange="updateTeamStat('${team.team}', 'wins', this.value)"></small></div>
                    <div><small>Н: <input type="number" value="${team.draws}" class="score-input" onchange="updateTeamStat('${team.team}', 'draws', this.value)"></small></div>
                    <div><small>П: <input type="number" value="${team.losses}" class="score-input" onchange="updateTeamStat('${team.team}', 'losses', this.value)"></small></div>
                    <div><small>О: <input type="number" value="${team.points}" class="score-input" onchange="updateTeamStat('${team.team}', 'points', this.value)"></small></div>
                    <div><small>ГЗ: <input type="number" value="${team.goalsFor}" class="score-input" onchange="updateTeamStat('${team.team}', 'goalsFor', this.value)"></small></div>
                    <div><small>ГП: <input type="number" value="${team.goalsAgainst}" class="score-input" onchange="updateTeamStat('${team.team}', 'goalsAgainst', this.value)"></small></div>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== ФУНКЦИИ УПРАВЛЕНИЯ =====

// Заявки
async function approveRegistration(id) {
    const reg = adminData.pendingRegistrations.find(r => r.id === id);
    if (!reg) return;
    
    // Добавляем команду в таблицу
    adminData.standings.push({
        team: reg.team,
        owner: reg.owner,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
    });
    
    // Удаляем из ожидания
    adminData.pendingRegistrations = adminData.pendingRegistrations.filter(r => r.id !== id);
    
    await saveAllData();
    renderAdminPanels();
    alert(`Команда "${reg.team}" добавлена в лигу!`);
}

function rejectRegistration(id) {
    adminData.pendingRegistrations = adminData.pendingRegistrations.filter(r => r.id !== id);
    saveAllData();
    renderAdminPanels();
}

// Команды
function addTeamManually() {
    const name = document.getElementById('newTeamName').value.trim();
    const owner = document.getElementById('newTeamOwner').value.trim();
    
    if (!name || !owner) {
        alert('Заполните все поля');
        return;
    }
    
    if (adminData.standings.some(t => t.team === name)) {
        alert('Команда с таким названием уже существует');
        return;
    }
    
    adminData.standings.push({
        team: name,
        owner: owner,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
    });
    
    document.getElementById('newTeamName').value = '';
    document.getElementById('newTeamOwner').value = '';
    
    saveAllData();
    renderAdminPanels();
    alert(`Команда "${name}" добавлена!`);
}

function editTeam(teamName) {
    const newName = prompt('Новое название команды:', teamName);
    if (newName && newName !== teamName) {
        const team = adminData.standings.find(t => t.team === teamName);
        team.team = newName;
        // Обновляем также в матчах
        adminData.matches.forEach(m => {
            if (m.homeTeam === teamName) m.homeTeam = newName;
            if (m.awayTeam === teamName) m.awayTeam = newName;
        });
        saveAllData();
        renderAdminPanels();
    }
}

function deleteTeam(teamName) {
    if (!confirm(`Удалить команду "${teamName}"? Все её матчи также будут удалены.`)) return;
    
    adminData.standings = adminData.standings.filter(t => t.team !== teamName);
    adminData.matches = adminData.matches.filter(m => m.homeTeam !== teamName && m.awayTeam !== teamName);
    saveAllData();
    renderAdminPanels();
}

// Матчи
function populateTeamSelects() {
    const selectHTML = adminData.standings.map(t => `<option value="${t.team}">${t.team} (${t.owner})</option>`).join('');
    document.querySelectorAll('select[id^="match"]').forEach(select => {
        select.innerHTML = `<option value="">Выберите команду</option>${selectHTML}`;
    });
}

function showMatchForm() {
    document.getElementById('matchForm').style.display = 'block';
}

function addMatch() {
    const home = document.getElementById('matchHome').value;
    const away = document.getElementById('matchAway').value;
    const date = document.getElementById('matchDate').value;
    const time = document.getElementById('matchTime').value;
    
    if (!home || !away || !date) {
        alert('Заполните обязательные поля');
        return;
    }
    
    if (home === away) {
        alert('Команды не могут играть сами с собой');
        return;
    }
    
    adminData.matches.push({
        id: Date.now(),
        homeTeam: home,
        awayTeam: away,
        date: date,
        time: time,
        status: 'scheduled',
        homeScore: 0,
        awayScore: 0
    });
    
    document.getElementById('matchForm').reset();
    document.getElementById('matchForm').style.display = 'none';
    saveAllData();
    renderAdminPanels();
}

function generateRound() {
    if (adminData.standings.length < 2) {
        alert('Нужно как минимум 2 команды для жеребьевки');
        return;
    }
    
    const teams = [...adminData.standings.map(t => t.team)];
    const shuffled = teams.sort(() => Math.random() - 0.5);
    const matches = [];
    
    // Создаем пары
    for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
            const date = new Date();
            date.setDate(date.getDate() + 7); // Матчи через неделю
            
            matches.push({
                id: Date.now() + i,
                homeTeam: shuffled[i],
                awayTeam: shuffled[i + 1],
                date: date.toISOString().split('T')[0],
                status: 'scheduled',
                homeScore: 0,
                awayScore: 0
            });
        }
    }
    
    if (confirm(`Создать ${matches.length} матчей на следующий раунд?`)) {
        adminData.matches.push(...matches);
        saveAllData();
        renderAdminPanels();
        alert(`Создано ${matches.length} матчей!`);
    }
}

function startMatch(matchId) {
    const match = adminData.matches.find(m => m.id == matchId);
    if (!match) return;
    
    match.status = 'live';
    match.minute = 1;
    match.homeScore = 0;
    match.awayScore = 0;
    
    saveAllData();
    renderAdminPanels();
}

function updateScore(matchId, side, increment) {
    const match = adminData.matches.find(m => m.id == matchId);
    if (!match) return;
    
    if (side === 'home') {
        match.homeScore = (match.homeScore || 0) + increment;
    } else {
        match.awayScore = (match.awayScore || 0) + increment;
    }
    
    saveAllData();
    renderAdminPanels();
}

function updateMinute(matchId, minute) {
    const match = adminData.matches.find(m => m.id == matchId);
    if (match) {
        match.minute = parseInt(minute) || 1;
        saveAllData();
    }
}

function finishMatch(matchId) {
    const match = adminData.matches.find(m => m.id == matchId);
    if (!match) return;
    
    match.status = 'finished';
    
    // Обновляем статистику команд
    updateTeamStatsAfterMatch(match);
    
    saveAllData();
    renderAdminPanels();
    alert('Матч завершен! Статистика обновлена.');
}

function updateTeamStatsAfterMatch(match) {
    const homeTeam = adminData.standings.find(t => t.team === match.homeTeam);
    const awayTeam = adminData.standings.find(t => t.team === match.awayTeam);
    
    if (!homeTeam || !awayTeam) return;
    
    // Обновляем сыгранные матчи
    homeTeam.played++;
    awayTeam.played++;
    
    // Обновляем голы
    homeTeam.goalsFor += match.homeScore;
    homeTeam.goalsAgainst += match.awayScore;
    awayTeam.goalsFor += match.awayScore;
    awayTeam.goalsAgainst += match.homeScore;
    
    // Определяем результат
    if (match.homeScore > match.awayScore) {
        homeTeam.wins++;
        homeTeam.points += 3;
        awayTeam.losses++;
    } else if (match.homeScore < match.awayScore) {
        awayTeam.wins++;
        awayTeam.points += 3;
        homeTeam.losses++;
    } else {
        homeTeam.draws++;
        awayTeam.draws++;
        homeTeam.points += 1;
        awayTeam.points += 1;
    }
}

function reopenMatch(matchId) {
    const match = adminData.matches.find(m => m.id == matchId);
    if (!match) return;
    
    // Возвращаем статистику команд
    const homeTeam = adminData.standings.find(t => t.team === match.homeTeam);
    const awayTeam = adminData.standings.find(t => t.team === match.awayTeam);
    
    if (homeTeam && awayTeam) {
        // Откатываем статистику (упрощенно)
        homeTeam.played = Math.max(0, homeTeam.played - 1);
        awayTeam.played = Math.max(0, awayTeam.played - 1);
        homeTeam.goalsFor -= match.homeScore;
        homeTeam.goalsAgainst -= match.awayScore;
        awayTeam.goalsFor -= match.awayScore;
        awayTeam.goalsAgainst -= match.homeScore;
        
        // Откатываем очки
        if (match.homeScore > match.awayScore) {
            homeTeam.wins = Math.max(0, homeTeam.wins - 1);
            homeTeam.points = Math.max(0, homeTeam.points - 3);
            awayTeam.losses = Math.max(0, awayTeam.losses - 1);
        } else if (match.homeScore < match.awayScore) {
            awayTeam.wins = Math.max(0, awayTeam.wins - 1);
            awayTeam.points = Math.max(0, awayTeam.points - 3);
            homeTeam.losses = Math.max(0, homeTeam.losses - 1);
        } else {
            homeTeam.draws = Math.max(0, homeTeam.draws - 1);
            awayTeam.draws = Math.max(0, awayTeam.draws - 1);
            homeTeam.points = Math.max(0, homeTeam.points - 1);
            awayTeam.points = Math.max(0, awayTeam.points - 1);
        }
    }
    
    match.status = 'scheduled';
    match.homeScore = 0;
    match.awayScore = 0;
    delete match.minute;
    
    saveAllData();
    renderAdminPanels();
}

function editMatch(matchId) {
    const match = adminData.matches.find(m => m.id == matchId);
    if (!match) return;
    
    const newDate = prompt('Новая дата (ГГГГ-ММ-ДД):', match.date.split('T')[0]);
    if (newDate) {
        match.date = newDate;
        saveAllData();
        renderAdminPanels();
    }
}

function deleteMatch(matchId) {
    if (!confirm('Удалить этот матч?')) return;
    adminData.matches = adminData.matches.filter(m => m.id != matchId);
    saveAllData();
    renderAdminPanels();
}

// Новости
function addNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    const image = document.getElementById('newsImage').value.trim();
    
    if (!title || !content) {
        alert('Заполните заголовок и текст');
        return;
    }
    
    adminData.news.unshift({
        id: Date.now(),
        title: title,
        content: content,
        image: image || null,
        date: new Date().toISOString()
    });
    
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('newsImage').value = '';
    
    saveAllData();
    renderAdminPanels();
    alert('Новость добавлена!');
}

function deleteNews(newsId) {
    if (!confirm('Удалить эту новость?')) return;
    adminData.news = adminData.news.filter(n => n.id != newsId);
    saveAllData();
    renderAdminPanels();
}

// Таблица
function updateTeamStat(teamName, stat, value) {
    const team = adminData.standings.find(t => t.team === teamName);
    if (team) {
        team[stat] = parseInt(value) || 0;
        
        // Автоматически пересчитываем очки если меняем победы/ничьи
        if (stat === 'wins') {
            team.points = (team.wins * 3) + (team.draws * 1);
        } else if (stat === 'draws') {
            team.points = (team.wins * 3) + (team.draws * 1);
        }
    }
}

// ===== СОХРАНЕНИЕ ДАННЫХ =====
async function saveAllData() {
    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminData)
        });
        
        if (response.ok) {
            console.log('✅ Данные сохранены');
            return true;
        } else {
            throw new Error('Ошибка сохранения');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка сохранения данных!');
        return false;
    }
}

// ===== PWA ДЛЯ АДМИНКИ =====
let adminDeferredPrompt;
const adminInstallBtn = document.getElementById('adminInstallBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    adminDeferredPrompt = e;
    if (adminInstallBtn) adminInstallBtn.style.display = 'block';
    
    adminInstallBtn?.addEventListener('click', () => {
        if (adminDeferredPrompt) {
            adminInstallBtn.style.display = 'none';
            adminDeferredPrompt.prompt();
            adminDeferredPrompt.userChoice.then((choiceResult) => {
                adminDeferredPrompt = null;
            });
        }
    });
});

// Автосохранение каждые 30 секунд
setInterval(saveAllData, 30000);

// Загружаем данные при загрузке страницы (после авторизации)
if (document.getElementById('adminContent').style.display === 'block') {
    loadAdminData();
}