# 🚀 Руководство по развертыванию на production

Эта инструкция предназначена для развертывания URL Shortener на production сервере.

> **Примечание:** Для локальной разработки см. `/INSTALLATION.md`

---

## 📋 Предварительные требования

### Что вам понадобится

- ✅ Готовое приложение (установлено по `/INSTALLATION.md`)
- ✅ Доменное имя (например, `shorturl.com`)
- ✅ Настроенный Supabase проект
- ✅ Хостинг для статических файлов (Vercel, Netlify, или свой сервер)

---

## 🎯 Варианты развертывания

### Вариант 1: Vercel (Рекомендуется для начинающих)

Самый простой способ развернуть приложение.

#### Шаг 1: Подготовка

1. Создайте аккаунт на [vercel.com](https://vercel.com)
2. Установите Vercel CLI:
```bash
npm install -g vercel
```

#### Шаг 2: Деплой

```bash
# Войдите в аккаунт
vercel login

# Соберите проект
npm run build

# Задеплойте
vercel --prod
```

#### Шаг 3: Настройка environment variables

В панели Vercel:
1. Перейдите в **Settings → Environment Variables**
2. Добавьте:
   - `VITE_SUPABASE_URL` = `https://ваш-проект.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `ваш-anon-key`

#### Готово! 🎉

Ваше приложение доступно по URL от Vercel или вашему кастомному домену.

---

### Вариант 2: Netlify

#### Шаг 1: Установка Netlify CLI

```bash
npm install -g netlify-cli
```

#### Шаг 2: Деплой

```bash
# Войдите в аккаунт
netlify login

# Соберите проект
npm run build

# Задеплойте
netlify deploy --prod
```

Укажите директорию `dist` когда Netlify спросит.

---

### Вариант 3: Свой сервер (Ubuntu 22.04)

Для опытных пользователей, которым нужен полный контроль.

#### Требования

- Ubuntu 22.04 LTS
- Минимум 2GB RAM
- Root или sudo доступ
- Настроенные DNS записи

#### Быстрая установка

```bash
# Скачайте deploy скрипт
wget https://your-repo/deploy.sh

# Сделайте исполняемым
chmod +x deploy.sh

# Запустите
sudo bash deploy.sh
```

Скрипт автоматически установит:
- Node.js
- Nginx
- SSL сертификат
- Соберет и задеплоит приложение

#### Ручная установка

См. подробную инструкцию в `/docs/MANUAL_DEPLOYMENT.md`

---

## 🔧 Настройка Supabase Edge Functions

Edge Functions необходимы для backend логики (создание ссылок, статистика и т.д.)

### Шаг 1: Установка Supabase CLI

```bash
npm install -g supabase
```

### Шаг 2: Авторизация

```bash
supabase login
```

Откроется браузер для авторизации.

### Шаг 3: Линковка проекта

```bash
cd ваш-проект
supabase link --project-ref ваш-project-id
```

### Шаг 4: Деплой функций

```bash
# Задеплойте функцию server
supabase functions deploy server

# Установите environment variables
supabase secrets set SUPABASE_URL=https://ваш-проект.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=ваш-service-role-key
supabase secrets set SUPABASE_ANON_KEY=ваш-anon-key
```

### Шаг 5: Проверка

```bash
# Проверьте, что функция работает
curl https://ваш-проект.supabase.co/functions/v1/server/health
```

Должно вернуть: `{"status":"ok"}`

---

## 🔐 Настройка OAuth провайдеров

### Google OAuth

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com)
2. Создайте новый проект или выберите существующий
3. Включите **Google+ API**
4. Создайте **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `https://ваш-проект.supabase.co/auth/v1/callback`
5. Скопируйте **Client ID** и **Client Secret**
6. В Supabase Dashboard → **Authentication → Providers → Google**:
   - Включите Google
   - Вставьте Client ID и Secret
   - Сохраните

### Facebook OAuth

1. Перейдите на [Facebook Developers](https://developers.facebook.com)
2. Создайте новое приложение
3. Добавьте продукт **Facebook Login**
4. Настройте Valid OAuth Redirect URIs: `https://ваш-проект.supabase.co/auth/v1/callback`
5. Скопируйте **App ID** и **App Secret**
6. В Supabase Dashboard → **Authentication → Providers → Facebook**:
   - Включите Facebook
   - Вставьте App ID и Secret
   - Сохраните

---

## 📊 Мониторинг

### Supabase Dashboard

Отслеживайте:
- **Database**: использование и производительность
- **Edge Functions**: логи и ошибки
- **Auth**: активных пользователей
- **Storage**: если используете

### Логи Edge Functions

В Supabase Dashboard:
1. **Edge Functions** → выберите функцию
2. Вкладка **Logs**
3. Фильтруйте по времени и типу

### Уведомления

Настройте уведомления в Supabase:
1. **Project Settings → Integrations**
2. Подключите Slack, Discord или Email

---

## 🔄 Обновление приложения

### При использовании Vercel/Netlify

```bash
# Просто задеплойте снова
npm run build
vercel --prod
# или
netlify deploy --prod
```

### При использовании своего сервера

```bash
ssh user@ваш-сервер

cd /var/www/url-shortener

# Получите обновления
git pull origin main

# Переустановите зависимости (если изменились)
npm install

# Пересоберите
npm run build

# Перезапустите веб-сервер
sudo systemctl reload nginx
```

### Обновление Edge Functions

```bash
# Локально
cd ваш-проект

# Задеплойте обновленные функции
supabase functions deploy server
```

---

## 🛡 Безопасность

### Обязательные настройки

1. **Включите Row Level Security (RLS)** для всех таблиц
2. **Используйте HTTPS** для production
3. **Храните секретные ключи** в environment variables
4. **Настройте CORS** правильно в Edge Functions
5. **Регулярно обновляйте** зависимости

### Рекомендации

- Включите двухфакторную аутентификацию в Supabase
- Настройте rate limiting в Supabase
- Используйте CDN (Cloudflare) для защиты от DDoS
- Делайте регулярные бэкапы базы данных

---

## 📈 Оптимизация производительности

### Frontend

1. **Используйте CDN** для статических файлов
2. **Включите кеширование** в Nginx/CDN
3. **Минимизируйте bundle size**:
   ```bash
   npm run build -- --report
   ```

### Backend (Edge Functions)

1. **Оптимизируйте запросы** к базе данных
2. **Используйте кеширование** для частых запросов
3. **Мониторьте производительность** через Supabase Dashboard

### База данных

1. **Создайте индексы** для часто запрашиваемых полей
2. **Настройте Connection Pooling** в Supabase
3. **Регулярно анализируйте** медленные запросы

---

## 💾 Бэкапы

### Автоматические бэкапы Supabase

Supabase автоматически создает бэкапы:
- **Free tier**: бэкапы за последние 7 дней
- **Pro tier**: бэкапы за последние 30 дней

### Ручной бэкап

1. В Supabase Dashboard → **Database → Backups**
2. Нажмите **Create backup**
3. Бэкап будет создан в течение нескольких минут

### Восстановление

1. **Database → Backups**
2. Выберите бэкап
3. Нажмите **Restore**

---

## 📞 Поддержка

### Документация

- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Netlify Docs](https://docs.netlify.com)

### Проблемы

- Проверьте логи в Supabase Dashboard
- Проверьте консоль браузера (F12)
- Создайте Issue в репозитории проекта

### Статус сервисов

- Supabase: [status.supabase.com](https://status.supabase.com)
- Vercel: [vercel-status.com](https://vercel-status.com)

---

## ✅ Checklist перед запуском

- [ ] Supabase проект настроен и работает
- [ ] Все SQL скрипты выполнены
- [ ] Edge Functions задеплоены и протестированы
- [ ] Environment variables настроены
- [ ] OAuth провайдеры настроены (если используете)
- [ ] SSL сертификат установлен (для своего сервера)
- [ ] Домен настроен и резолвится
- [ ] Админ пользователь создан
- [ ] Бэкапы настроены
- [ ] Мониторинг работает

---

## 🎉 Готово!

Ваш URL Shortener готов к работе на production!

**Успешного запуска! 🚀**

---

**Примечание:** Для подробной технической информации см. `/ARCHITECTURE.md`
