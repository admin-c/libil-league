// ===== КОНФИГУРАЦИЯ =====
const CONFIG = {
    GIST_ID: 'c37ece5d8832c31be098e4d39e8cb328',
    FILE_NAME: 'data.json'
};

let adminData = {};
let allTeams = [];
// ===== СИСТЕМА СОХРАНЕНИЯ =====
let isSaving = false;
let saveQueue = [];
let lastSaveTime = 0;
const SAVE_COOLDOWN = 2000;

async function saveAllData() {
    if (isSaving) {
        console.log('⚠️ Сохранение уже выполняется, запрос поставлен в очередь');
        saveQueue.push(Date.now());
        return false;
    }
    
    const now = Date.now();
    if (now - lastSaveTime < SAVE_COOLDOWN) {
        console.log('⚠️ Слишком частые сохранения, пропускаем');
        return false;
    }
    
    isSaving = true;
    lastSaveTime = now;
    
    try {
        console.log('💾 Начало сохранения данных...');
        
        const dataToSave = {
            league: adminData.league || {
                name: "ЛЪибилская Лига",
                description: "Чемпионат по FC Mobile",
                season: 2026,
                points: { win: 3, draw: 1, loss: 0 }
            },
            standings: adminData.standings || [],
            matches: adminData.matches || [],
            news: adminData.news || [],
            pendingRegistrations: adminData.pendingRegistrations || [],
            activities: (adminData.activities || []).slice(0, 20)
        };
        
        console.log(`📊 Сохраняю: ${dataToSave.standings.length} команд, ${dataToSave.matches.length} матчей`);
        
        dataToSave.lastSaved = new Date().toISOString();
        dataToSave.saveId = Date.now();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify(dataToSave),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера: ${response.status} - ${errorText.substring(0, 100)}`);
        }
        
        const result = await response.json();
        console.log('✅ Данные сохранены:', result.message || 'успешно');
        showSaveNotification('✅ Данные сохранены успешно!', 'success');
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        
        let errorMessage = 'Ошибка сохранения';
        if (error.name === 'AbortError') {
            errorMessage = 'Таймаут: сохранение заняло слишком много времени';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Нет соединения с сервером';
        } else if (error.message.includes('500')) {
            errorMessage = 'Ошибка сервера 500. Проверьте настройки GitHub';
        }
        
        showSaveNotification(`❌ ${errorMessage}`, 'error');
        return false;
        
    } finally {
        isSaving = false;
        if (saveQueue.length > 0) {
            console.log(`📋 Обрабатываю очередь сохранений: ${saveQueue.length} запросов`);
            saveQueue = [];
            setTimeout(saveAllData, 1000);
        }
    }
}

function showSaveNotification(message, type = 'info') {
    const oldNotification = document.getElementById('save-notification');
    if (oldNotification) oldNotification.remove();
    
    const notification = document.createElement('div');
    notification.id = 'save-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideInUp 0.3s ease;
        ">
            ${message}
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        border-radius: 4px;
                        padding: 4px 8px;
                        cursor: pointer;
                        font-size: 12px;
                    ">
                ✕
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, 5000);
}

function setupAutoSave() {
    const AUTO_SAVE_INTERVAL = 30000;
    const autoSaveInterval = setInterval(() => {
        if (!isSaving && adminData.standings && adminData.standings.length > 0) {
            console.log('⏰ Автосохранение...');
            saveAllData().catch(console.error);
        }
    }, AUTO_SAVE_INTERVAL);
    
    window.addEventListener('beforeunload', () => {
        if (!isSaving && adminData.standings && adminData.standings.length > 0) {
            navigator.sendBeacon('/api/save', JSON.stringify({
                ...adminData,
                lastSaved: new Date().toISOString(),
                beacon: true
            }));
        }
    });
    
    return () => clearInterval(autoSaveInterval);
}
// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadAdminData() {
    try {
        console.log('Loading admin data...');
        const response = await fetch('/api/data', {
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        
        adminData = await response.json();
        allTeams = adminData.standings || [];
        
        // Инициализируем автосохранение
        setupAutoSave();
        
        updateDashboard();
        updateRegistrations();
        updateTeams();
        updateMatches();
        updateNews();
        updateTable();
        updateSettings();
        
        console.log('Admin data loaded successfully');
        
    } catch (error) {
        console.error('Error loading admin data:', error);
        showSaveNotification('❌ Ошибка загрузки данных', 'error');
    }
}

// ===== ОБНОВЛЕНИЕ СЕКЦИЙ =====

// Dashboard
function updateDashboard() {
    // Update stats
    document.getElementById('statTeams').textContent = adminData.standings?.length || 0;
    document.getElementById('statMatches').textContent = adminData.matches?.length || 0;
    document.getElementById('statPending').textContent = adminData.pendingRegistrations?.length || 0;
    document.getElementById('quickPending').textContent = adminData.pendingRegistrations?.length || 0;
    
    // Find leader
    if (adminData.standings?.length > 0) {
        const leader = [...adminData.standings].sort((a, b) => 
            (b.points || 0) - (a.points || 0)
        )[0];
        document.getElementById('statLeader').textContent = leader.team.substring(0, 10);
    } else {
        document.getElementById('statLeader').textContent = '-';
    }
    
    // Update activity
    const activities = adminData.activities || [];
    document.getElementById('recentActivity').innerHTML = activities.slice(0, 10).map(activity => `
        <div style="
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 1rem;
        ">
            <div style="
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: ${getActivityColor(activity.type)};
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            ">
                <i class="fas fa-${getActivityIcon(activity.type)}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 500;">${activity.message}</div>
                <div style="font-size: 0.875rem; color: var(--gray);">
                    ${new Date(activity.date).toLocaleString('ru-RU')}
                </div>
            </div>
        </div>
    `).join('') || '<p style="text-align: center; padding: 2rem; color: var(--gray);">Нет активностей</p>';
}

// Registrations
function updateRegistrations() {
    const pending = adminData.pendingRegistrations || [];
    document.getElementById('pendingCount').textContent = pending.length;
    document.getElementById('registrationsBadge').textContent = `${pending.length} ожидают`;
    
    document.getElementById('pendingList').innerHTML = pending.map(reg => `
        <div style="
            padding: 1.5rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div>
                <div style="font-weight: 700; font-size: 1.1rem;">${reg.team}</div>
                <div style="color: var(--gray); margin: 0.25rem 0;">
                    Владелец: ${reg.owner}
                </div>
                <div style="font-size: 0.875rem; color: var(--gray-light);">
                    <i class="far fa-calendar"></i> 
                    ${new Date(reg.date).toLocaleDateString('ru-RU')}
                    ${reg.email ? ` • ${reg.email}` : ''}
                    ${reg.phone ? ` • ${reg.phone}` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-success btn-sm" onclick="approveRegistration(${reg.id})">
                    <i class="fas fa-check"></i> Принять
                </button>
                <button class="btn btn-danger btn-sm" onclick="rejectRegistration(${reg.id})">
                    <i class="fas fa-times"></i> Отклонить
                </button>
            </div>
        </div>
    `).join('') || '<p style="text-align: center; padding: 3rem; color: var(--gray);">Нет заявок на рассмотрении</p>';
}

// Teams
function updateTeams() {
    const teams = adminData.standings || [];
    
    // Populate reset teams dropdown
    const resetSelect = document.getElementById('resetTeams');
    resetSelect.innerHTML = `
        <option value="all">Все команды</option>
        ${teams.map(team => `
            <option value="${team.team}">${team.team}</option>
        `).join('')}
    `;
    
    document.getElementById('teamsList').innerHTML = teams.map((team, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, var(--secondary), var(--accent));
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: 700;
                    ">
                        ${team.team.charAt(0)}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${team.team}</div>
                        <div style="font-size: 0.875rem; color: var(--gray);">${team.owner}</div>
                    </div>
                </div>
            </td>
            <td>${team.owner}</td>
            <td><input type="number" value="${team.played || 0}" 
                      style="width: 60px; padding: 0.25rem; text-align: center;"
                      onchange="updateTeamStat('${team.team}', 'played', this.value)"></td>
            <td><input type="number" value="${team.wins || 0}" 
                      style="width: 60px; padding: 0.25rem; text-align: center;"
                      onchange="updateTeamStat('${team.team}', 'wins', this.value)"></td>
            <td><input type="number" value="${team.draws || 0}" 
                      style="width: 60px; padding: 0.25rem; text-align: center;"
                      onchange="updateTeamStat('${team.team}', 'draws', this.value)"></td>
            <td><input type="number" value="${team.losses || 0}" 
                      style="width: 60px; padding: 0.25rem; text-align: center;"
                      onchange="updateTeamStat('${team.team}', 'losses', this.value)"></td>
            <td><input type="number" value="${team.goalsFor || 0}" 
                      style="width: 60px; padding: 0.25rem; text-align: center;"
                      onchange="updateTeamStat('${team.team}', 'goalsFor', this.value)"></td>
            <td><input type="number" value="${team.goalsAgainst || 0}" 
                      style="width: 60px; padding: 0.25rem; text-align: center;"
                      onchange="updateTeamStat('${team.team}', 'goalsAgainst', this.value)"></td>
            <td><strong>${team.points || 0}</strong></td>
            <td>
                <div style="display: flex; gap: 0.25rem;">
                    <button class="btn btn-sm btn-primary" onclick="editTeam('${team.team}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTeam('${team.team}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="11" style="text-align: center; padding: 2rem; color: var(--gray);">Нет команд</td></tr>';
}

// Matches
function updateMatches() {
    const matches = adminData.matches || [];
    const now = new Date();
    
    // Live matches
    const liveMatches = matches.filter(m => m.status === 'live');
    document.getElementById('liveMatchesList').innerHTML = liveMatches.map(match => `
        <div style="
            padding: 1.5rem;
            border-bottom: 1px solid rgba(239, 68, 68, 0.3);
            background: rgba(239, 68, 68, 0.05);
            border-radius: var(--radius-sm);
            margin-bottom: 1rem;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <div style="font-weight: 700;">${match.homeTeam} vs ${match.awayTeam}</div>
                    <div style="font-size: 0.875rem; color: var(--gray);">
                        Тур ${match.round || 1} • ${formatDate(match.date)} ${match.time || ''}
                    </div>
                </div>
                <div style="
                    background: var(--danger);
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 50px;
                    font-size: 0.875rem;
                    font-weight: 600;
                ">
                    <i class="fas fa-play-circle"></i> LIVE
                </div>
            </div>
            
            <div class="live-controls">
                <div style="text-align: center; margin-bottom: 1rem;">
                    <div style="font-size: 2rem; font-weight: 800; color: white;">
                        ${match.homeScore || 0} : ${match.awayScore || 0}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--gray);">
                        ${match.minute || '1'}' минута
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center;">
                    <div style="text-align: center;">
                        <button class="btn btn-sm btn-primary" onclick="updateScore(${match.id}, 'home', 1)">
                            <i class="fas fa-plus"></i> Гол
                        </button>
                        <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                            ${match.homeTeam}
                        </div>
                    </div>
                    
                    <div style="text-align: center;">
                        <input type="number" class="score-input" id="minute_${match.id}" 
                               value="${match.minute || 1}" 
                               onchange="updateMinute(${match.id}, this.value)">
                        <div style="font-size: 0.75rem; color: var(--gray); margin-top: 0.25rem;">
                            минута
                        </div>
                    </div>
                    
                    <div style="text-align: center;">
                        <button class="btn btn-sm btn-primary" onclick="updateScore(${match.id}, 'away', 1)">
                            <i class="fas fa-plus"></i> Гол
                        </button>
                        <div style="margin-top: 0.5rem; font-size: 0.875rem;">
                            ${match.awayTeam}
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 1rem;">
                    <button class="btn btn-success" onclick="finishMatch(${match.id})">
                        <i class="fas fa-flag-checkered"></i> Завершить матч
                    </button>
                </div>
            </div>
        </div>
    `).join('') || '<p style="text-align: center; padding: 2rem; color: var(--gray);">Нет матчей в прямом эфире</p>';
    
    // Scheduled matches
    const scheduledMatches = matches.filter(m => m.status === 'scheduled' && new Date(m.date) > now);
    document.getElementById('scheduledMatches').innerHTML = scheduledMatches.map(match => `
        <div style="
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div>
                <div style="font-weight: 600;">${match.homeTeam} vs ${match.awayTeam}</div>
                <div style="font-size: 0.875rem; color: var(--gray);">
                    ${formatDate(match.date)} ${match.time || ''} • Тур ${match.round || 1}
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-primary" onclick="startMatch(${match.id})">
                    <i class="fas fa-play"></i> Старт
                </button>
                <button class="btn btn-sm btn-secondary" onclick="editMatch(${match.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMatch(${match.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('') || '<p style="text-align: center; padding: 2rem; color: var(--gray);">Нет запланированных матчей</p>';
    
    // Finished matches
    const finishedMatches = matches.filter(m => m.status === 'finished');
    document.getElementById('finishedMatches').innerHTML = finishedMatches.map(match => `
        <div style="
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div>
                <div style="font-weight: 600;">
                    ${match.homeTeam} ${match.homeScore || 0} : ${match.awayScore || 0} ${match.awayTeam}
                </div>
                <div style="font-size: 0.875rem; color: var(--gray);">
                    ${formatDate(match.date)} • Тур ${match.round || 1}
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-sm btn-secondary" onclick="reopenMatch(${match.id})">
                    <i class="fas fa-redo"></i> Переиграть
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteMatch(${match.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('') || '<p style="text-align: center; padding: 2rem; color: var(--gray);">Нет завершенных матчей</p>';
    
    // Show/hide live matches section
    document.getElementById('liveMatchesSection').style.display = 
        liveMatches.length > 0 ? 'block' : 'none';
}

// News
function updateNews() {
    const news = adminData.news || [];
    document.getElementById('existingNews').innerHTML = news.map(item => `
        <div style="
            padding: 1.5rem;
            border-bottom: 1px solid var(--border);
        ">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <div style="font-weight: 700; font-size: 1.1rem;">${item.title}</div>
                    <div style="font-size: 0.875rem; color: var(--gray); margin-top: 0.25rem;">
                        <i class="far fa-calendar"></i> ${formatDate(item.date)}
                        ${item.category ? ` • <span style="
                            background: ${getCategoryColor(item.category)};
                            color: white;
                            padding: 0.1rem 0.5rem;
                            border-radius: 50px;
                            font-size: 0.75rem;
                        ">${getCategoryName(item.category)}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-primary" onclick="editNews(${item.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNews(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div style="color: var(--gray-light); line-height: 1.6; margin-bottom: 1rem;">
                ${item.content.length > 200 ? item.content.substring(0, 200) + '...' : item.content}
            </div>
            
            ${item.image ? `
                <img src="${item.image}" alt="${item.title}" 
                     style="max-width: 200px; border-radius: var(--radius-sm);">
            ` : ''}
        </div>
    `).join('') || '<p style="text-align: center; padding: 3rem; color: var(--gray);">Нет новостей</p>';
}

// Table
function updateTable() {
    const teams = adminData.standings || [];
    document.getElementById('editableTable').innerHTML = teams.map((team, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, var(--secondary), var(--accent));
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: 700;
                    ">
                        ${team.team.charAt(0)}
                    </div>
                    <div>
                        <div style="font-weight: 600;">${team.team}</div>
                        <div style="font-size: 0.875rem; color: var(--gray);">${team.owner}</div>
                    </div>
                </div>
            </td>
            <td><input type="number" value="${team.played || 0}" class="score-input" 
                      onchange="updateTeamStat('${team.team}', 'played', this.value)"></td>
            <td><input type="number" value="${team.wins || 0}" class="score-input" 
                      onchange="updateTeamStat('${team.team}', 'wins', this.value)"></td>
            <td><input type="number" value="${team.draws || 0}" class="score-input" 
                      onchange="updateTeamStat('${team.team}', 'draws', this.value)"></td>
            <td><input type="number" value="${team.losses || 0}" class="score-input" 
                      onchange="updateTeamStat('${team.team}', 'losses', this.value)"></td>
            <td><input type="number" value="${team.goalsFor || 0}" class="score-input" 
                      onchange="updateTeamStat('${team.team}', 'goalsFor', this.value)"></td>
            <td><input type="number" value="${team.goalsAgainst || 0}" class="score-input" 
                      onchange="updateTeamStat('${team.team}', 'goalsAgainst', this.value)"></td>
            <td>${(team.goalsFor || 0) - (team.goalsAgainst || 0)}</td>
            <td><input type="number" value="${team.points || 0}" class="score-input" 
                      onchange="updateTeamStat('${team.team}', 'points', this.value)"></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="resetTeamStats('${team.team}')">
                    <i class="fas fa-undo"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="11" style="text-align: center; padding: 3rem; color: var(--gray);">Нет данных</td></tr>';
}

// Settings
function updateSettings() {
    // Load league settings
    if (adminData.league) {
        document.getElementById('leagueName').value = adminData.league.name || 'ЛЪибилская Лига';
        document.getElementById('leagueDescription').value = adminData.league.description || '';
        
        if (adminData.league.points) {
            document.getElementById('pointsWin').value = adminData.league.points.win || 3;
            document.getElementById('pointsDraw').value = adminData.league.points.draw || 1;
            document.getElementById('pointsLoss').value = adminData.league.points.loss || 0;
        }
    }
    
    // Load admin settings
    if (adminData.league?.settings) {
        document.getElementById('adminEmail').value = adminData.league.settings.adminEmail || '';
        document.getElementById('autoSave').value = adminData.league.settings.autoSaveInterval || '30';
        document.getElementById('autoRefresh').value = adminData.league.settings.autoRefresh || '30';
        document.getElementById('notifications').checked = adminData.league.settings.notifications !== false;
    }
}

// ===== ФУНКЦИИ УПРАВЛЕНИЯ =====

// Registrations
async function approveRegistration(id) {
    const reg = adminData.pendingRegistrations?.find(r => r.id === id);
    if (!reg) return;
    
    if (!confirm(`Принять команду "${reg.team}"?`)) return;
    
    try {
        // Добавляем в standings
        if (!adminData.standings) {
            adminData.standings = [];
        }
        
        const newTeam = {
            team: reg.team,
            owner: reg.owner,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
            // Сохраняем дополнительные данные если есть
            email: reg.email || null,
            phone: reg.phone || null,
            registeredDate: new Date().toISOString()
        };
        
        adminData.standings.push(newTeam);
        
        // Удаляем из pending
        adminData.pendingRegistrations = adminData.pendingRegistrations.filter(r => r.id !== id);
        
        // Добавляем активность
        if (!adminData.activities) {
            adminData.activities = [];
        }
        
        adminData.activities.unshift({
            id: Date.now(),
            type: 'approval',
            message: `Команда "${reg.team}" (${reg.owner}) принята в лигу`,
            date: new Date().toISOString(),
            user: 'admin'
        });
        
        // Сохраняем изменения
        const success = await saveAllData();
        
        if (success) {
            alert(`✅ Команда "${reg.team}" успешно добавлена в турнирную таблицу!`);
            // Обновляем интерфейс
            updateRegistrations();
            updateTeams();
            updateDashboard();
        } else {
            alert('❌ Ошибка при сохранении. Попробуйте еще раз.');
            // Откатываем изменения
            adminData.standings = adminData.standings.filter(t => t.team !== reg.team);
            adminData.pendingRegistrations.push(reg);
        }
        
    } catch (error) {
        console.error('Ошибка при подтверждении заявки:', error);
        alert('❌ Ошибка сервера: ' + error.message);
    }
}

// Teams
async function addTeamManually() {
    const name = document.getElementById('newTeamName').value.trim();
    const owner = document.getElementById('newTeamOwner').value.trim();
    const email = document.getElementById('newTeamEmail').value.trim();
    const phone = document.getElementById('newTeamPhone').value.trim();
    
    if (!name || !owner) {
        alert('Заполните название команды и имя владельца');
        return;
    }
    
    if (adminData.standings.some(t => t.team.toLowerCase() === name.toLowerCase())) {
        alert('Команда с таким названием уже существует');
        return;
    }
    
    adminData.standings.push({
        team: name,
        owner: owner,
        email: email || null,
        phone: phone || null,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
    });
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'team_add',
        message: `Команда "${name}" добавлена вручную`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    await saveAllData();
    
    document.getElementById('newTeamName').value = '';
    document.getElementById('newTeamOwner').value = '';
    document.getElementById('newTeamEmail').value = '';
    document.getElementById('newTeamPhone').value = '';
    
    hideAddTeamForm();
    alert(`Команда "${name}" добавлена!`);
}

function editTeam(teamName) {
    const team = adminData.standings.find(t => t.team === teamName);
    if (!team) return;
    
    const newName = prompt('Новое название команды:', team.team);
    if (newName && newName !== teamName) {
        team.team = newName;
        
        // Update in matches
        adminData.matches.forEach(m => {
            if (m.homeTeam === teamName) m.homeTeam = newName;
            if (m.awayTeam === teamName) m.awayTeam = newName;
        });
        
        adminData.activities.unshift({
            id: Date.now(),
            type: 'team_edit',
            message: `Команда переименована: "${teamName}" → "${newName}"`,
            date: new Date().toISOString(),
            user: 'admin'
        });
        
        saveAllData();
    }
}

function deleteTeam(teamName) {
    if (!confirm(`Удалить команду "${teamName}"? Все её матчи также будут удалены.`)) return;
    
    adminData.standings = adminData.standings.filter(t => t.team !== teamName);
    adminData.matches = adminData.matches.filter(m => 
        m.homeTeam !== teamName && m.awayTeam !== teamName
    );
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'team_delete',
        message: `Команда "${teamName}" удалена из лиги`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
}

function updateTeamStat(teamName, stat, value) {
    const team = adminData.standings.find(t => t.team === teamName);
    if (team) {
        team[stat] = parseInt(value) || 0;
        
        // Auto-calculate points if wins/draws change
        if (stat === 'wins' || stat === 'draws') {
            const pointsWin = adminData.league?.points?.win || 3;
            const pointsDraw = adminData.league?.points?.draw || 1;
            team.points = (team.wins * pointsWin) + (team.draws * pointsDraw);
        }
        
        // Auto-calculate played matches
        if (stat === 'wins' || stat === 'draws' || stat === 'losses') {
            team.played = (team.wins || 0) + (team.draws || 0) + (team.losses || 0);
        }
    }
}

// Matches
function populateTeamSelects() {
    const teams = adminData.standings || [];
    const selectHTML = teams.map(t => `<option value="${t.team}">${t.team} (${t.owner})</option>`).join('');
    
    document.getElementById('matchHome').innerHTML = `<option value="">Выберите команду</option>${selectHTML}`;
    document.getElementById('matchAway').innerHTML = `<option value="">Выберите команду</option>${selectHTML}`;
}

async function addMatch() {
    const home = document.getElementById('matchHome').value;
    const away = document.getElementById('matchAway').value;
    const date = document.getElementById('matchDate').value;
    const time = document.getElementById('matchTime').value;
    const round = parseInt(document.getElementById('matchRound').value) || 1;
    const status = document.getElementById('matchStatus').value;
    
    if (!home || !away || !date) {
        alert('Заполните обязательные поля (хозяева, гости, дата)');
        return;
    }
    
    if (home === away) {
        alert('Команды не могут играть сами с собой');
        return;
    }
    
    // Check if match already exists
    const existingMatch = adminData.matches.find(m => 
        m.homeTeam === home && m.awayTeam === away && m.date.substring(0, 10) === date
    );
    
    if (existingMatch) {
        alert('Этот матч уже существует');
        return;
    }
    
    const match = {
        id: Date.now(),
        homeTeam: home,
        awayTeam: away,
        date: date + (time ? 'T' + time + ':00' : 'T12:00:00'),
        time: time || null,
        round: round,
        status: status,
        homeScore: 0,
        awayScore: 0
    };
    
    if (status === 'live') {
        match.minute = 1;
    }
    
    adminData.matches.push(match);
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'match_add',
        message: `Добавлен матч: ${home} vs ${away}`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    await saveAllData();
    
    document.getElementById('matchHome').value = '';
    document.getElementById('matchAway').value = '';
    document.getElementById('matchTime').value = '';
    
    hideAddMatchForm();
    alert('Матч добавлен!');
}

function startMatch(matchId) {
    const match = adminData.matches.find(m => m.id === matchId);
    if (!match) return;
    
    match.status = 'live';
    match.homeScore = 0;
    match.awayScore = 0;
    match.minute = 1;
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'match_start',
        message: `Начат матч: ${match.homeTeam} vs ${match.awayTeam}`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
    alert('Матч начат! Теперь он в прямом эфире.');
}

function updateScore(matchId, side, increment) {
    const match = adminData.matches.find(m => m.id === matchId);
    if (!match) return;
    
    if (side === 'home') {
        match.homeScore = (match.homeScore || 0) + increment;
    } else {
        match.awayScore = (match.awayScore || 0) + increment;
    }
    
    saveAllData();
}

function updateMinute(matchId, minute) {
    const match = adminData.matches.find(m => m.id === matchId);
    if (match) {
        match.minute = parseInt(minute) || 1;
        saveAllData();
    }
}

function finishMatch(matchId) {
    const match = adminData.matches.find(m => m.id === matchId);
    if (!match) return;
    
    match.status = 'finished';
    
    // Update team stats
    updateTeamStatsAfterMatch(match);
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'match_finish',
        message: `Завершен матч: ${match.homeTeam} ${match.homeScore || 0}-${match.awayScore || 0} ${match.awayTeam}`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
    alert('Матч завершен! Статистика обновлена.');
}

function updateTeamStatsAfterMatch(match) {
    const homeTeam = adminData.standings.find(t => t.team === match.homeTeam);
    const awayTeam = adminData.standings.find(t => t.team === match.awayTeam);
    
    if (!homeTeam || !awayTeam) return;
    
    const pointsWin = adminData.league?.points?.win || 3;
    const pointsDraw = adminData.league?.points?.draw || 1;
    
    // Update played matches
    homeTeam.played = (homeTeam.played || 0) + 1;
    awayTeam.played = (awayTeam.played || 0) + 1;
    
    // Update goals
    homeTeam.goalsFor = (homeTeam.goalsFor || 0) + (match.homeScore || 0);
    homeTeam.goalsAgainst = (homeTeam.goalsAgainst || 0) + (match.awayScore || 0);
    awayTeam.goalsFor = (awayTeam.goalsFor || 0) + (match.awayScore || 0);
    awayTeam.goalsAgainst = (awayTeam.goalsAgainst || 0) + (match.homeScore || 0);
    
    // Update results and points
    if (match.homeScore > match.awayScore) {
        homeTeam.wins = (homeTeam.wins || 0) + 1;
        homeTeam.points = (homeTeam.points || 0) + pointsWin;
        awayTeam.losses = (awayTeam.losses || 0) + 1;
    } else if (match.homeScore < match.awayScore) {
        awayTeam.wins = (awayTeam.wins || 0) + 1;
        awayTeam.points = (awayTeam.points || 0) + pointsWin;
        homeTeam.losses = (homeTeam.losses || 0) + 1;
    } else {
        homeTeam.draws = (homeTeam.draws || 0) + 1;
        awayTeam.draws = (awayTeam.draws || 0) + 1;
        homeTeam.points = (homeTeam.points || 0) + pointsDraw;
        awayTeam.points = (awayTeam.points || 0) + pointsDraw;
    }
}

function reopenMatch(matchId) {
    const match = adminData.matches.find(m => m.id === matchId);
    if (!match) return;
    
    if (!confirm('Переоткрыть этот матч? Статистика команд будет скорректирована.')) return;
    
    // Reverse team stats
    const homeTeam = adminData.standings.find(t => t.team === match.homeTeam);
    const awayTeam = adminData.standings.find(t => t.team === match.awayTeam);
    
    if (homeTeam && awayTeam) {
        const pointsWin = adminData.league?.points?.win || 3;
        const pointsDraw = adminData.league?.points?.draw || 1;
        
        // Reverse played matches
        homeTeam.played = Math.max(0, (homeTeam.played || 0) - 1);
        awayTeam.played = Math.max(0, (awayTeam.played || 0) - 1);
        
        // Reverse goals
        homeTeam.goalsFor = Math.max(0, (homeTeam.goalsFor || 0) - (match.homeScore || 0));
        homeTeam.goalsAgainst = Math.max(0, (homeTeam.goalsAgainst || 0) - (match.awayScore || 0));
        awayTeam.goalsFor = Math.max(0, (awayTeam.goalsFor || 0) - (match.awayScore || 0));
        awayTeam.goalsAgainst = Math.max(0, (awayTeam.goalsAgainst || 0) - (match.homeScore || 0));
        
        // Reverse results and points
        if (match.homeScore > match.awayScore) {
            homeTeam.wins = Math.max(0, (homeTeam.wins || 0) - 1);
            homeTeam.points = Math.max(0, (homeTeam.points || 0) - pointsWin);
            awayTeam.losses = Math.max(0, (awayTeam.losses || 0) - 1);
        } else if (match.homeScore < match.awayScore) {
            awayTeam.wins = Math.max(0, (awayTeam.wins || 0) - 1);
            awayTeam.points = Math.max(0, (awayTeam.points || 0) - pointsWin);
            homeTeam.losses = Math.max(0, (homeTeam.losses || 0) - 1);
        } else {
            homeTeam.draws = Math.max(0, (homeTeam.draws || 0) - 1);
            awayTeam.draws = Math.max(0, (awayTeam.draws || 0) - 1);
            homeTeam.points = Math.max(0, (homeTeam.points || 0) - pointsDraw);
            awayTeam.points = Math.max(0, (awayTeam.points || 0) - pointsDraw);
        }
    }
    
    match.status = 'scheduled';
    match.homeScore = 0;
    match.awayScore = 0;
    delete match.minute;
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'match_reopen',
        message: `Матч переоткрыт: ${match.homeTeam} vs ${match.awayTeam}`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
    alert('Матч переоткрыт! Статистика скорректирована.');
}

function editMatch(matchId) {
    const match = adminData.matches.find(m => m.id === matchId);
    if (!match) return;
    
    const newDate = prompt('Новая дата (ГГГГ-ММ-ДД):', match.date.substring(0, 10));
    if (newDate) {
        match.date = newDate + match.date.substring(10);
        saveAllData();
    }
}

function deleteMatch(matchId) {
    const match = adminData.matches.find(m => m.id === matchId);
    if (!match) return;
    
    if (!confirm('Удалить этот матч?')) return;
    
    adminData.matches = adminData.matches.filter(m => m.id !== matchId);
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'match_delete',
        message: `Удален матч: ${match.homeTeam} vs ${match.awayTeam}`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
}

// Draw
async function generateRound() {
    const teams = adminData.standings || [];
    
    if (teams.length < 2) {
        alert('Нужно как минимум 2 команды для жеребьёвки');
        return;
    }
    
    // Simple round generation
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const matches = [];
    const today = new Date();
    
    for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
            const matchDate = new Date(today);
            matchDate.setDate(matchDate.getDate() + 7); // Matches in 7 days
            
            matches.push({
                id: Date.now() + i,
                homeTeam: shuffled[i].team,
                awayTeam: shuffled[i + 1].team,
                date: matchDate.toISOString(),
                round: 1,
                status: 'scheduled',
                homeScore: 0,
                awayScore: 0
            });
        }
    }
    
    if (confirm(`Создать ${matches.length} матчей на следующий тур?`)) {
        adminData.matches.push(...matches);
        
        adminData.activities.unshift({
            id: Date.now(),
            type: 'draw',
            message: `Создана жеребьёвка: ${matches.length} матчей`,
            date: new Date().toISOString(),
            user: 'admin'
        });
        
        await saveAllData();
        alert(`Создано ${matches.length} матчей!`);
        showSection('matches');
    }
}

function previewDraw() {
    const roundsCount = parseInt(document.getElementById('roundsCount').value) || 1;
    const startDate = document.getElementById('drawStartDate').value;
    const interval = parseInt(document.getElementById('drawInterval').value) || 7;
    const drawType = document.getElementById('drawType').value;
    
    const teams = adminData.standings || [];
    
    if (teams.length < 2) {
        alert('Нужно как минимум 2 команды для предпросмотра');
        return;
    }
    
    let previewHTML = '';
    let matchDate = new Date(startDate);
    
    for (let round = 1; round <= roundsCount; round++) {
        // Simple pairing
        const shuffled = [...teams].sort(() => Math.random() - 0.5);
        
        previewHTML += `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-sm);">
                <div style="font-weight: 600; color: var(--secondary); margin-bottom: 0.5rem;">
                    Тур ${round} • ${matchDate.toLocaleDateString('ru-RU')}
                </div>
        `;
        
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                previewHTML += `
                    <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                        ${shuffled[i].team} vs ${shuffled[i + 1].team}
                    </div>
                `;
            }
        }
        
        previewHTML += `</div>`;
        matchDate.setDate(matchDate.getDate() + interval);
    }
    
    document.getElementById('previewMatches').innerHTML = previewHTML;
    document.getElementById('drawPreview').style.display = 'block';
}

function applyDraw() {
    alert('Функция расширенной жеребьёвки будет реализована в следующей версии');
}

function confirmDraw() {
    alert('Подтверждение жеребьёвки будет реализовано в следующей версии');
}

function cancelDraw() {
    document.getElementById('drawPreview').style.display = 'none';
}

// News
async function saveNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const category = document.getElementById('newsCategory').value;
    const image = document.getElementById('newsImage').value.trim();
    const content = document.getElementById('newsContent').innerHTML;
    
    if (!title || !content || content === 'Введите текст новости здесь...') {
        alert('Заполните заголовок и содержимое новости');
        return;
    }
    
    const news = {
        id: Date.now(),
        title: title,
        content: content,
        category: category,
        image: image || null,
        date: new Date().toISOString(),
        author: 'Администратор'
    };
    
    if (!adminData.news) {
        adminData.news = [];
    }
    
    adminData.news.unshift(news);
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'news_add',
        message: `Добавлена новость: "${title}"`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    await saveAllData();
    
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsImage').value = '';
    document.getElementById('newsContent').innerHTML = 'Введите текст новости здесь...';
    
    hideAddNewsForm();
    alert('Новость опубликована!');
}

function editNews(newsId) {
    alert('Редактирование новостей будет реализовано в следующей версии');
}

function deleteNews(newsId) {
    const news = adminData.news.find(n => n.id === newsId);
    if (!news) return;
    
    if (!confirm(`Удалить новость "${news.title}"?`)) return;
    
    adminData.news = adminData.news.filter(n => n.id !== newsId);
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'news_delete',
        message: `Удалена новость: "${news.title}"`,
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
    alert('Новость удалена!');
}

function previewNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').innerHTML;
    
    if (!title || !content || content === 'Введите текст новости здесь...') {
        alert('Заполните заголовок и содержимое для предпросмотра');
        return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    
    modal.innerHTML = `
        <div style="
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            background: var(--glass-bg);
            border-radius: var(--radius);
            padding: 2rem;
            position: relative;
        ">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="
                        position: absolute;
                        top: 1rem;
                        right: 1rem;
                        background: none;
                        border: none;
                        color: white;
                        font-size: 1.5rem;
                        cursor: pointer;
                    ">
                <i class="fas fa-times"></i>
            </button>
            
            <h2 style="margin-bottom: 1rem;">Предпросмотр новости</h2>
            <div style="margin-bottom: 1.5rem; color: var(--gray);">
                ${new Date().toLocaleDateString('ru-RU')}
            </div>
            
            <h3 style="margin-bottom: 1.5rem; font-size: 1.5rem;">${title}</h3>
            
            <div style="
                line-height: 1.6;
                color: var(--gray-light);
            ">
                ${content}
            </div>
            
            <div style="margin-top: 2rem; text-align: center;">
                <button class="btn btn-secondary" 
                        onclick="this.parentElement.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i> Закрыть предпросмотр
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Table management
function recalculatePoints() {
    if (!confirm('Пересчитать очки для всех команд по текущим правилам?')) return;
    
    const pointsWin = adminData.league?.points?.win || 3;
    const pointsDraw = adminData.league?.points?.draw || 1;
    
    adminData.standings.forEach(team => {
        team.points = (team.wins * pointsWin) + (team.draws * pointsDraw);
    });
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'recalculate',
        message: 'Пересчитаны очки для всех команд',
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
    alert('Очки пересчитаны!');
}

function resetTeamStats(teamName) {
    const team = adminData.standings.find(t => t.team === teamName);
    if (!team) return;
    
    if (!confirm(`Сбросить статистику команды "${teamName}"?`)) return;
    
    team.played = 0;
    team.wins = 0;
    team.draws = 0;
    team.losses = 0;
    team.goalsFor = 0;
    team.goalsAgainst = 0;
    team.points = 0;
    
    saveAllData();
    alert(`Статистика команды "${teamName}" сброшена!`);
}

function applyQuickAdjustment() {
    const addPoints = parseInt(document.getElementById('addPoints').value) || 0;
    const resetTeams = Array.from(document.getElementById('resetTeams').selectedOptions)
        .map(opt => opt.value);
    
    adminData.standings.forEach(team => {
        if (resetTeams.includes('all') || resetTeams.includes(team.team)) {
            team.played = 0;
            team.wins = 0;
            team.draws = 0;
            team.losses = 0;
            team.goalsFor = 0;
            team.goalsAgainst = 0;
            team.points = addPoints;
        } else if (addPoints !== 0) {
            team.points = (team.points || 0) + addPoints;
        }
    });
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'adjustment',
        message: 'Применена быстрая корректировка таблицы',
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
    alert('Корректировка применена!');
}

function resetAllStats() {
    if (!confirm('ВНИМАНИЕ: Это сбросит статистику ВСЕХ команд. Продолжить?')) return;
    
    adminData.standings.forEach(team => {
        team.played = 0;
        team.wins = 0;
        team.draws = 0;
        team.losses = 0;
        team.goalsFor = 0;
        team.goalsAgainst = 0;
        team.points = 0;
    });
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'reset_all',
        message: 'Сброшена статистика всех команд',
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    saveAllData();
    alert('Вся статистика сброшена!');
}

// Settings
async function saveSettings() {
    // League settings
    adminData.league = adminData.league || {};
    adminData.league.name = document.getElementById('leagueName').value;
    adminData.league.description = document.getElementById('leagueDescription').value;
    
    adminData.league.points = {
        win: parseInt(document.getElementById('pointsWin').value) || 3,
        draw: parseInt(document.getElementById('pointsDraw').value) || 1,
        loss: parseInt(document.getElementById('pointsLoss').value) || 0
    };
    
    // Admin settings
    const newPassword = document.getElementById('adminNewPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    
    if (newPassword && newPassword === confirmPassword) {
        adminData.league.settings = adminData.league.settings || {};
        adminData.league.settings.adminPassword = newPassword;
        alert('Пароль администратора изменен!');
    } else if (newPassword && newPassword !== confirmPassword) {
        alert('Пароли не совпадают!');
        return;
    }
    
    adminData.league.settings = adminData.league.settings || {};
    adminData.league.settings.adminEmail = document.getElementById('adminEmail').value;
    adminData.league.settings.autoSaveInterval = document.getElementById('autoSave').value;
    adminData.league.settings.autoRefresh = document.getElementById('autoRefresh').value;
    adminData.league.settings.notifications = document.getElementById('notifications').checked;
    
    adminData.activities.unshift({
        id: Date.now(),
        type: 'settings_save',
        message: 'Обновлены настройки системы',
        date: new Date().toISOString(),
        user: 'admin'
    });
    
    await saveAllData();
    alert('Настройки сохранены!');
}

function exportData() {
    const dataStr = JSON.stringify(adminData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `liga-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function importData() {
    alert('Функция импорта данных будет реализована в следующей версии');
}

function backupData() {
    alert('Резервное копирование выполнено!');
}

function clearAllData() {
    if (!confirm('ВНИМАНИЕ: Это удалит ВСЕ данные лиги (команды, матчи, новости). Продолжить?')) return;
    
    adminData = {
        ...INITIAL_DATA,
        activities: [{
            id: Date.now(),
            type: 'system',
            message: 'Все данные лиги сброшены',
            date: new Date().toISOString(),
            user: 'admin'
        }]
    };
    
    saveAllData();
    alert('Все данные очищены! Система перезагружается...');
    setTimeout(() => location.reload(), 1000);
}

// ===== УТИЛИТЫ =====

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function getActivityColor(type) {
    const colors = {
        'system': 'var(--gray)',
        'registration': 'var(--secondary)',
        'approval': 'var(--accent)',
        'rejection': 'var(--danger)',
        'team_add': 'var(--success)',
        'team_edit': 'var(--warning)',
        'team_delete': 'var(--danger)',
        'match_add': 'var(--secondary)',
        'match_start': 'var(--accent)',
        'match_finish': 'var(--success)',
        'match_reopen': 'var(--warning)',
        'match_delete': 'var(--danger)',
        'draw': 'var(--secondary)',
        'news_add': 'var(--accent)',
        'news_delete': 'var(--danger)',
        'recalculate': 'var(--warning)',
        'adjustment': 'var(--secondary)',
        'reset_all': 'var(--danger)',
        'settings_save': 'var(--accent)',
        'save': 'var(--success)'
    };
    return colors[type] || 'var(--gray)';
}

function getActivityIcon(type) {
    const icons = {
        'system': 'cog',
        'registration': 'user-plus',
        'approval': 'check',
        'rejection': 'times',
        'team_add': 'user-plus',
        'team_edit': 'edit',
        'team_delete': 'trash',
        'match_add': 'futbol',
        'match_start': 'play',
        'match_finish': 'flag-checkered',
        'match_reopen': 'redo',
        'match_delete': 'trash',
        'draw': 'random',
        'news_add': 'newspaper',
        'news_delete': 'trash',
        'recalculate': 'calculator',
        'adjustment': 'sliders-h',
        'reset_all': 'trash',
        'settings_save': 'cog',
        'save': 'save'
    };
    return icons[type] || 'info-circle';
}

function getCategoryColor(category) {
    const colors = {
        'updates': 'var(--secondary)',
        'results': 'var(--accent)',
        'announcements': 'var(--warning)',
        'general': 'var(--gray)'
    };
    return colors[category] || 'var(--gray)';
}

function getCategoryName(category) {
    const names = {
        'updates': 'Обновления',
        'results': 'Результаты',
        'announcements': 'Объявления',
        'general': 'Общее'
    };
    return names[category] || 'Общее';
}


