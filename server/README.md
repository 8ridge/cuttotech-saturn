# URL Shortener Backend API

Node.js backend server для URL Shortener, использующий PostgreSQL и Supabase Auth.

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Заполните переменные окружения в `.env`:
   - `DATABASE_URL` - уже настроен (PostgreSQL на localhost)
   - `SUPABASE_URL` - ваш Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` - найдите в Supabase Dashboard → Settings → API → service_role key
   - `SUPABASE_ANON_KEY` - ваш anon key
   - `BASE_URL` - ваш домен (например, https://yourdomain.com)

## Запуск

### Development:
```bash
npm run dev
```

### Production:
```bash
npm start
```

Или с PM2:
```bash
pm2 start index.js --name urlshortener-api
pm2 save
```

## API Endpoints

Все endpoints доступны по адресу: `http://localhost:3000`

- `GET /health` - Health check
- `POST /signup` - Регистрация пользователя
- `POST /shorten` - Создать короткую ссылку
- `GET /redirect/:code` - Получить оригинальный URL
- `GET /stats/:code` - Статистика по ссылке
- `GET /user/urls` - Список ссылок пользователя
- `DELETE /url/:code` - Удалить ссылку
- `GET /admin/urls` - Все ссылки (только админ)
- `POST /admin/content` - Управление контентом (только админ)
- `POST /admin/add-by-email` - Добавить админа по email

## Где найти SUPABASE_SERVICE_ROLE_KEY?

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в Settings → API
4. Найдите "service_role" key (секретный ключ)
5. Скопируйте его в `.env` файл

**⚠️ ВАЖНО:** Никогда не публикуйте service_role key! Он дает полный доступ к вашей базе данных.

