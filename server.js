const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Конфигурация из переменных окружения Render.com
const CONFIG = {
    GIST_ID: process.env.GIST_ID || 'c37ece5d8832c31be098e4d39e8cb328',
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    FILE_NAME: 'data.json'
};

const GIST_URL = `https://api.github.com/gists/${CONFIG.GIST_ID}`;
const AUTH_HEADERS = {
    'Authorization': `Bearer ${CONFIG.GITHUB_TOKEN}`,
    'User-Agent': 'Liga-App',
    'Content-Type': 'application/json'
};

// Начальные данные
const INITIAL_DATA = {
    teams: [],
    standings: [],
    matches: [],
    news: [
        {
            id: 1,
            title: "Добро пожаловать в ЛЪибилскую Лигу!",
            content: "Чемпионат по FC Mobile начинается 24.01.2026. Регистрируйте команды!",
            date: "2026-01-20T10:00:00Z",
            image: null
        }
    ],
    pendingRegistrations: []
};

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Прокси для GitHub API
app.get('/api/data', async (req, res) => {
    try {
        const response = await fetch(GIST_URL, { headers: AUTH_HEADERS });
        
        if (!response.ok) {
            if (response.status === 404) {
                // Если gist не найден, создаем его
                await createInitialGist();
                return res.json(INITIAL_DATA);
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const gist = await response.json();
        
        if (gist.files && gist.files[CONFIG.FILE_NAME]) {
            const content = JSON.parse(gist.files[CONFIG.FILE_NAME].content);
            res.json(content);
        } else {
            // Если файл не существует в gist
            await updateGist(INITIAL_DATA);
            res.json(INITIAL_DATA);
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        res.status(500).json({ error: 'Ошибка загрузки данных' });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        // Загружаем текущие данные
        const dataResponse = await fetch(GIST_URL, { headers: AUTH_HEADERS });
        let data = INITIAL_DATA;
        
        if (dataResponse.ok) {
            const gist = await dataResponse.json();
            if (gist.files && gist.files[CONFIG.FILE_NAME]) {
                data = JSON.parse(gist.files[CONFIG.FILE_NAME].content);
            }
        }
        
        // Добавляем новую заявку
        const newRegistration = req.body;
        if (!data.pendingRegistrations) {
            data.pendingRegistrations = [];
        }
        data.pendingRegistrations.push(newRegistration);
        
        // Сохраняем обновленные данные
        await updateGist(data);
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка регистрации' });
    }
});

app.post('/api/save', async (req, res) => {
    try {
        await updateGist(req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

// Функция создания начального gist
async function createInitialGist() {
    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
                description: 'ЛЪибилская Лига - данные чемпионата',
                public: false,
                files: {
                    [CONFIG.FILE_NAME]: {
                        content: JSON.stringify(INITIAL_DATA, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('Не удалось создать gist');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка создания gist:', error);
        throw error;
    }
}

// Функция обновления Gist
async function updateGist(data) {
    const response = await fetch(GIST_URL, {
        method: 'PATCH',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
            files: {
                [CONFIG.FILE_NAME]: {
                    content: JSON.stringify(data, null, 2)
                }
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return response.json();
}

// Редирект на админку
app.get('/admin', (req, res) => {
    res.redirect('/admin.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`GIST_ID: ${CONFIG.GIST_ID}`);
    console.log(`GitHub Token: ${CONFIG.GITHUB_TOKEN ? 'Установлен' : 'Отсутствует'}`);
});
