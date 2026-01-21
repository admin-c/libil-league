const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Конфигурация из переменных окружения
const CONFIG = {
    GIST_ID: process.env.GIST_ID || 'c37ece5d8832c31be098e4d39e8cb328',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    FILE_NAME: 'data.json'
};

const GIST_URL = `https://api.github.com/gists/${CONFIG.GIST_ID}`;
const AUTH_HEADERS = {
    'Authorization': `Bearer ${CONFIG.GITHUB_TOKEN}`,
    'User-Agent': 'Liga-App',
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3+json'
};

// Начальные данные с полной структурой
const INITIAL_DATA = {
    league: {
        name: "ЛЪибилская Лига",
        description: "Чемпионат по FC Mobile. Матчи проходят каждые выходные.",
        season: 2026,
        points: {
            win: 3,
            draw: 1,
            loss: 0
        },
        settings: {
            autoSave: true,
            notifications: true,
            adminPassword: "Ali"
        }
    },
    standings: [],
    matches: [],
    news: [
        {
            id: 1,
            title: "Добро пожаловать в ЛЪибилскую Лигу!",
            content: "Чемпионат по FC Mobile начинается 24.01.2026. Регистрируйте команды! Первые матчи уже скоро.",
            category: "announcements",
            image: null,
            date: "2026-01-20T10:00:00Z",
            author: "Администратор"
        },
        {
            id: 2,
            title: "Регистрация команд открыта",
            content: "Вы можете зарегистрировать свою команду до 23.01.2026. Участие бесплатное!",
            category: "updates",
            image: null,
            date: "2026-01-19T14:30:00Z",
            author: "Администратор"
        }
    ],
    pendingRegistrations: [],
    activities: [
        {
            id: 1,
            type: "system",
            message: "Система запущена и готова к работе",
            date: new Date().toISOString(),
            user: "system"
        }
    ]
};

// Middleware
app.use(express.json());
app.use(express.static('.'));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        gist_id: CONFIG.GIST_ID,
        version: '2.0.0'
    });
});

// Get all data
app.get('/api/data', async (req, res) => {
    try {
        console.log('Fetching data from GitHub Gist...');
        
        const response = await fetch(GIST_URL, { 
            headers: AUTH_HEADERS,
            timeout: 10000
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('Gist not found, creating initial data...');
                await createInitialGist();
                return res.json(INITIAL_DATA);
            }
            throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
        }
        
        const gist = await response.json();
        
        if (!gist.files || !gist.files[CONFIG.FILE_NAME]) {
            console.log('Data file not found in gist, creating...');
            await updateGist(INITIAL_DATA);
            return res.json(INITIAL_DATA);
        }
        
        const fileContent = gist.files[CONFIG.FILE_NAME].content;
        const data = JSON.parse(fileContent);
        
        // Ensure data has all required fields
        const completeData = {
            ...INITIAL_DATA,
            ...data,
            standings: data.standings || [],
            matches: data.matches || [],
            news: data.news || INITIAL_DATA.news,
            pendingRegistrations: data.pendingRegistrations || [],
            activities: data.activities || INITIAL_DATA.activities
        };
        
        res.json(completeData);
        
    } catch (error) {
        console.error('Error loading data:', error.message);
        res.status(500).json({ 
            error: 'Failed to load data',
            message: error.message,
            fallback: true,
            data: INITIAL_DATA
        });
    }
});

// Register new team
app.post('/api/register', async (req, res) => {
    try {
        console.log('📝 Получена новая заявка на регистрацию');
        
        // Загружаем текущие данные
        const dataResponse = await fetch(GIST_URL, { headers: AUTH_HEADERS });
        let data = INITIAL_DATA;
        
        if (dataResponse.ok) {
            const gist = await dataResponse.json();
            if (gist.files && gist.files[CONFIG.FILE_NAME]) {
                data = JSON.parse(gist.files[CONFIG.FILE_NAME].content);
                console.log('✅ Данные успешно загружены из Gist');
            } else {
                console.log('⚠️ Файл data.json не найден в Gist, создаем новый');
            }
        } else {
            console.warn('⚠️ Не удалось загрузить данные, используем начальные');
        }
        
        const registration = req.body;
        console.log('Данные заявки:', registration);
        
        // Валидация
        if (!registration.team || !registration.owner) {
            console.error('❌ Отсутствует название команды или владелец');
            return res.status(400).json({ 
                error: 'Название команды и имя владельца обязательны' 
            });
        }
        
        // Проверяем дубликаты в standings
        if (data.standings && data.standings.some(t => 
            t.team.toLowerCase() === registration.team.toLowerCase())) {
            console.error(`❌ Команда "${registration.team}" уже существует в лиге`);
            return res.status(400).json({ 
                error: 'Команда с таким названием уже зарегистрирована в лиге' 
            });
        }
        
        // Проверяем дубликаты в pending registrations
        if (data.pendingRegistrations && data.pendingRegistrations.some(r => 
            r.team.toLowerCase() === registration.team.toLowerCase())) {
            console.error(`❌ Заявка для "${registration.team}" уже отправлена`);
            return res.status(400).json({ 
                error: 'Заявка на эту команду уже отправлена и ожидает подтверждения' 
            });
        }
        
        // Подготавливаем заявку
        const newRegistration = {
            id: Date.now(),
            team: registration.team.trim(),
            owner: registration.owner.trim(),
            email: registration.email?.trim() || null,
            phone: registration.phone?.trim() || null,
            date: new Date().toISOString(),
            status: 'pending',
            ip: req.ip || 'unknown'
        };
        
        // Инициализируем массивы если их нет
        if (!data.pendingRegistrations) {
            data.pendingRegistrations = [];
        }
        if (!data.activities) {
            data.activities = [];
        }
        
        // Добавляем заявку
        data.pendingRegistrations.push(newRegistration);
        
        // Добавляем активность
        data.activities.unshift({
            id: Date.now(),
            type: 'registration',
            message: `Новая заявка: ${newRegistration.team} (${newRegistration.owner})`,
            date: new Date().toISOString(),
            user: 'system'
        });
        
        // Сохраняем в Gist
        console.log('💾 Сохраняем данные в Gist...');
        await updateGist(data);
        console.log(`✅ Заявка "${newRegistration.team}" успешно сохранена`);
        
        res.json({ 
            success: true, 
            message: 'Заявка успешно отправлена и ожидает подтверждения',
            registrationId: newRegistration.id,
            team: newRegistration.team
        });
        
    } catch (error) {
        console.error('❌ Ошибка при обработке заявки:', error);
        res.status(500).json({ 
            error: 'Внутренняя ошибка сервера',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get all data (добавьте логирование)
app.get('/api/data', async (req, res) => {
    try {
        console.log('📥 Запрос данных...');
        
        const response = await fetch(GIST_URL, { 
            headers: AUTH_HEADERS,
            timeout: 10000
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('Gist не найден, возвращаем начальные данные');
                return res.json(INITIAL_DATA);
            }
            console.error(`GitHub API error: ${response.status}`);
            return res.status(500).json({ 
                error: 'Не удалось загрузить данные с GitHub',
                fallback: true,
                data: INITIAL_DATA
            });
        }
        
        const gist = await response.json();
        
        if (!gist.files || !gist.files[CONFIG.FILE_NAME]) {
            console.log('Файл data.json не найден, возвращаем начальные данные');
            return res.json(INITIAL_DATA);
        }
        
        const fileContent = gist.files[CONFIG.FILE_NAME].content;
        const data = JSON.parse(fileContent);
        
        // Объединяем с начальными данными для безопасности
        const completeData = {
            ...INITIAL_DATA,
            ...data,
            standings: data.standings || [],
            matches: data.matches || [],
            news: data.news || INITIAL_DATA.news,
            pendingRegistrations: data.pendingRegistrations || [],
            activities: data.activities || INITIAL_DATA.activities
        };
        
        console.log(`✅ Данные загружены: ${completeData.standings.length} команд, ${completeData.pendingRegistrations.length} заявок`);
        
        res.json(completeData);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        res.status(500).json({ 
            error: 'Ошибка загрузки данных',
            message: error.message,
            fallback: true,
            data: INITIAL_DATA
        });
    }
});
// Save all data (admin endpoint)
app.post('/api/save', async (req, res) => {
  try {
    console.log('Сохранение данных в Gist...');
    
    const data = req.body;
    
    // Проверяем наличие обязательных полей
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Неверные данные' });
    }
    
    // Убедимся, что есть все необходимые массивы
    const dataToSave = {
      league: data.league || INITIAL_DATA.league,
      standings: data.standings || [],
      matches: data.matches || [],
      news: data.news || [],
      pendingRegistrations: data.pendingRegistrations || [],
      activities: (data.activities || []).slice(0, 50)
    };
    
    // Логируем что сохраняем
    console.log('Сохраняем данные:', {
      teams: dataToSave.standings.length,
      matches: dataToSave.matches.length,
      news: dataToSave.news.length
    });
    
    // Сохраняем в Gist
    const response = await fetch(GIST_URL, {
      method: 'PATCH',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        description: 'ЛЪибилская Лига - данные чемпионата FC Mobile',
        files: {
          [CONFIG.FILE_NAME]: {
            content: JSON.stringify(dataToSave, null, 2)
          }
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API ошибка:', response.status, errorText);
      return res.status(500).json({ 
        error: 'Ошибка сохранения в GitHub',
        details: errorText.substring(0, 200)
      });
    }
    
    const result = await response.json();
    console.log('✅ Данные сохранены успешно');
    
    res.json({ 
      success: true, 
      message: 'Data saved successfully',
      timestamp: new Date().toISOString(),
      gistUrl: result.html_url
    });
    
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    res.status(500).json({ 
      error: 'Failed to save data',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


// Backup endpoint
app.get('/api/backup', async (req, res) => {
    try {
        const response = await fetch(GIST_URL, { headers: AUTH_HEADERS });
        const gist = await response.json();
        
        if (gist.files && gist.files[CONFIG.FILE_NAME]) {
            const data = JSON.parse(gist.files[CONFIG.FILE_NAME].content);
            
            res.setHeader('Content-Disposition', `attachment; filename="liga-backup-${Date.now()}.json"`);
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(data, null, 2));
        } else {
            res.status(404).json({ error: 'No data found' });
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// Helper function to create initial Gist
async function createInitialGist() {
    try {
        console.log('Creating initial Gist...');
        
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                description: 'ЛЪибилская Лига - данные чемпионата FC Mobile',
                public: false,
                files: {
                    [CONFIG.FILE_NAME]: {
                        content: JSON.stringify(INITIAL_DATA, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create Gist: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Gist created successfully:', result.id);
        return result;
        
    } catch (error) {
        console.error('Error creating Gist:', error);
        throw error;
    }
}

// Helper function to update Gist
async function updateGist(data) {
    try {
        console.log('Updating Gist...');
        
        // Clean up data before saving
        const cleanData = {
            ...data,
            // Ensure arrays exist
            standings: data.standings || [],
            matches: data.matches || [],
            news: data.news || [],
            pendingRegistrations: data.pendingRegistrations || [],
            activities: (data.activities || []).slice(0, 50) // Keep last 50 activities
        };
        
        const response = await fetch(GIST_URL, {
            method: 'PATCH',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                description: 'ЛЪибилская Лига - данные чемпионата FC Mobile',
                files: {
                    [CONFIG.FILE_NAME]: {
                        content: JSON.stringify(cleanData, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update Gist: ${response.status} - ${errorText}`);
        }
        
        console.log('Gist updated successfully');
        return await response.json();
        
    } catch (error) {
        console.error('Error updating Gist:', error);
        throw error;
    }
}

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

// Serve all other pages
app.get('*', (req, res) => {
    const page = req.path.replace('/', '');
    const validPages = ['index.html', 'table.html', 'fixtures.html', 'news.html', 'admin.html'];
    
    if (validPages.includes(page)) {
        res.sendFile(__dirname + '/' + page);
    } else if (page === '' || !page.includes('.')) {
        res.sendFile(__dirname + '/index.html');
    } else {
        res.status(404).send('Page not found');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 GIST_ID: ${CONFIG.GIST_ID}`);
    console.log(`🔑 GitHub Token: ${CONFIG.GITHUB_TOKEN ? 'Настроен' : 'ОТСУТСТВУЕТ (нужен для работы)'}`);
    console.log(`🌐 Доступные страницы:`);
    console.log(`   • Главная: http://localhost:${PORT}`);
    console.log(`   • Таблица: http://localhost:${PORT}/table.html`);
    console.log(`   • Расписание: http://localhost:${PORT}/fixtures.html`);
    console.log(`   • Новости: http://localhost:${PORT}/news.html`);
    console.log(`   • Админ-панель: http://localhost:${PORT}/admin.html`);
    console.log(`\n⚠️  ВАЖНО: Убедитесь, что в Render.com настроены переменные окружения:`);
    console.log(`   - GIST_ID: ваш_идентификатор_gist`);
    console.log(`   - GITHUB_TOKEN: ваш_токен_github`);
});


