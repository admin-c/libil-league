const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Конфигурация
const CONFIG = {
    GIST_ID: process.env.GIST_ID,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    FILE_NAME: 'data.json'
};

const GIST_URL = `https://api.github.com/gists/${CONFIG.GIST_ID}`;
const AUTH_HEADERS = {
    'Authorization': `Bearer ${CONFIG.GITHUB_TOKEN}`,
    'User-Agent': 'Liga-App'
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
            date: "2026-01-20T10:00:00Z"
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
        const gist = await response.json();
        
        if (gist.files && gist.files[CONFIG.FILE_NAME]) {
            const content = JSON.parse(gist.files[CONFIG.FILE_NAME].content);
            res.json(content);
        } else {
            // Если файл не существует, создаем его с начальными данными
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
        const gist = await dataResponse.json();
        let data = INITIAL_DATA;
        
        if (gist.files && gist.files[CONFIG.FILE_NAME]) {
            data = JSON.parse(gist.files[CONFIG.FILE_NAME].content);
        }
        
        // Добавляем новую заявку
        const newRegistration = req.body;
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

// Функция обновления Gist
async function updateGist(data) {
    const response = await fetch(GIST_URL, {
        method: 'PATCH',
        headers: {
            ...AUTH_HEADERS,
            'Content-Type': 'application/json'
        },
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

// Редирект на главную страницу
app.get('/admin', (req, res) => {
    res.redirect('/admin.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});