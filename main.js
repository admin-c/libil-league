// ===== КОНФИГУРАЦИЯ API =====
// Данные берутся из переменных окружения на Render.com
const CONFIG = {
    GIST_ID: 'fbed40bae479332bd2fdccb9fd62e7c1', // Ваш Gist ID
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
        
        // Показываем кнопку "Уже записаны" если пользователь уже зарегистрирован
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
            <td>${team.losses}</
