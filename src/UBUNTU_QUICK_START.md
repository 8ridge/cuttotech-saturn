# ⚡ Быстрый старт на Ubuntu 22.04

**Самый быстрый способ запустить URL Shortener на вашем Ubuntu сервере.**

⏱️ Время: **5-10 минут**

---

## 🎯 Что вы получите

После выполнения этой инструкции:
- ✅ Работающее приложение на `http://ваш-ip:3000`
- ✅ PM2 автозапуск при перезагрузке сервера
- ✅ Готовность к настройке базы данных

---

## 📋 Требования

- Ubuntu 22.04 LTS
- SSH доступ к серверу
- Открытый порт 3000
- 5-10 минут времени

**Не требуется:**
- ❌ Знание Linux
- ❌ Опыт разработки
- ❌ Домен или SSL

---

## 🚀 Вариант 1: Автоматическая установка

### Если файлы уже на сервере:

```bash
# Подключитесь к серверу
ssh ваш-пользователь@ваш-ip

# Перейдите в папку с проектом
cd /путь/к/url-shortener

# Запустите с��рипт
chmod +x quick-deploy.sh
bash quick-deploy.sh
```

Скрипт сам:
1. Установит Node.js 20
2. Спросит данные Supabase
3. Установит зависимости
4. Соберет проект
5. Настроит PM2
6. Запустит на порту 3000

### Если файлов нет на сервере:

```bash
# Подключитесь к серверу
ssh ваш-пользователь@ваш-ip

# Скачайте проект (замените на ваш репозиторий)
git clone https://github.com/ваш-репозиторий/url-shortener.git
cd url-shortener

# Запустите скрипт
chmod +x quick-deploy.sh
bash quick-deploy.sh
```

**⏱️ Готово через 5-10 минут!**

Переходите к [Шагу 3: Настройка базы данных](#-шаг-3-настройка-базы-данных)

---

## 🔧 Вариант 2: Ручная установка (5 команд)

Если автоматический скрипт не подходит:

### 1️⃣ Установите Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Проверка
```

### 2️⃣ Скопируйте файлы на сервер

**Вариант A:** Через Git
```bash
cd ~
git clone https://github.com/ваш-репозиторий/url-shortener.git
cd url-shortener
```

**Вариант B:** Через SCP (с локального компьютера)
```bash
# На вашем компьютере, в папке проекта:
scp -r * пользователь@ваш-ip:/home/пользователь/url-shortener/
```

### 3️⃣ Настройте Supabase

```bash
cd ~/url-shortener

# Отредактируйте файл
nano utils/supabase/info.tsx
```

Замените на ваши данные:
```typescript
export const projectId = "ваш-project-id"
export const publicAnonKey = "ваш-anon-key"
```

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

**Где взять данные:**
1. Откройте https://app.supabase.com
2. Выберите проект (или создайте новый)
3. Settings → API
4. Скопируйте Project ID и anon key

### 4️⃣ Установите зависимости и соберите

```bash
cd ~/url-shortener
npm install
npm run build
```

⏱️ Займет 2-5 минут.

### 5️⃣ Запустите с PM2

```bash
# Установите PM2
sudo npm install -g pm2

# Запустите приложение
pm2 start npm --name "url-shortener" -- run preview -- --host 0.0.0.0 --port 3000

# Настройте автозапуск
pm2 startup
pm2 save
```

**✅ Готово!** Приложение работает на `http://ваш-ip:3000`

---

## 🗄️ Шаг 3: Настройка базы данных

**Обязательно!** Без этого приложение не будет полностью работать.

### 1. Откройте Supabase Dashboard

https://app.supabase.com → Ваш проект

### 2. Создайте таблицы

1. Откройте **SQL Editor**
2. Создайте новый запрос
3. Скопируйте SQL из `/SERVER_DEPLOYMENT.md` (Шаг 10.1)
4. Нажмите **Run** (▶️)

Или используйте этот короткий вариант:

```sql
-- Таблица для ссылок
CREATE TABLE urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_code VARCHAR(10) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    clicks INTEGER DEFAULT 0
);

-- Таблица для статистики
CREATE TABLE clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url_id UUID REFERENCES urls(id),
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    country VARCHAR(100)
);

-- Включаем Row Level Security
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Public read" ON urls FOR SELECT USING (true);
CREATE POLICY "Users create own" ON urls FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 3. Включите Email аутентификацию

1. **Authentication → Providers**
2. Включите **Email**
3. Сохраните

**✅ База данных готова!**

---

## 🔥 Откройте порт 3000

Если не можете открыть сайт:

```bash
# Проверьте файрвол
sudo ufw status

# Если UFW активен, откройте порт
sudo ufw allow 3000/tcp
sudo ufw reload

# Проверьте снова
sudo ufw status
```

---

## 🌐 Проверка работы

### 1. Проверьте статус PM2

```bash
pm2 status
```

Должно быть: `status: online`

### 2. Откройте в браузере

```
http://ваш-ip-адрес:3000
```

**Узнать IP адрес:**
```bash
hostname -I | awk '{print $1}'
```

### 3. Зарегистрируйтесь

1. Нажмите "Sign Up"
2. Введите имя, email, пароль
3. Проверьте email (если настроен SMTP)

---

## 👨‍💼 Создание админа

### 1. Зарегистрируйтесь в приложении

### 2. Получите User ID

1. Supabase Dashboard → **Authentication → Users**
2. Найдите себя, скопируйте ID

### 3. Сделайте себя админом

1. **SQL Editor** → Новый запрос
2. Вставьте:

```sql
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'
)
WHERE id = 'ваш-user-id';
```

3. Нажмите **Run**

### 4. Перезайдите

Теперь у вас есть **Admin Panel** в меню!

---

## ⚡ Полезные команды

### Просмотр логов

```bash
pm2 logs url-shortener
```

### Перезапуск

```bash
pm2 restart url-shortener
```

### Остановка

```bash
pm2 stop url-shortener
```

### Обновление кода

```bash
cd ~/url-shortener
git pull
npm install
npm run build
pm2 restart url-shortener
```

---

## 🐛 Решение проблем

### Порт 3000 занят

```bash
# Найдите процесс
sudo lsof -i :3000

# Убейте его (замените PID)
sudo kill -9 PID

# Запустите заново
pm2 restart url-shortener
```

### Сайт не открывается

```bash
# 1. Проверьте PM2
pm2 status

# 2. Проверьте порт
sudo netstat -tlnp | grep 3000

# 3. Проверьте файрвол
sudo ufw status

# 4. Проверьте логи
pm2 logs url-shortener --lines 50
```

### Module not found

```bash
cd ~/url-shortener
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart url-shortener
```

---

## 📚 Дополнительные документы

- **[SERVER_COMMANDS.md](./SERVER_COMMANDS.md)** - 🔥 Шпаргалка всех команд
- **[SERVER_DEPLOYMENT.md](./SERVER_DEPLOYMENT.md)** - Полная инструкция
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production с доменом

---

## ✅ Checklist

- [ ] Node.js 20 установлен
- [ ] Файлы на сервере
- [ ] Supabase настроен
- [ ] Зависимости установлены
- [ ] Проект собран
- [ ] PM2 запущен
- [ ] Порт 3000 открыт
- [ ] База данных создана
- [ ] Email auth включен
- [ ] Админ создан
- [ ] Сайт открывается!

---

## 🎉 Готово!

Ваш URL Shortener работает на `http://ваш-ip:3000`

**Следующие шаги:**
1. Протестируйте создание ссылки
2. Настройте контент через Admin Panel
3. (Опционально) Настройте домен и SSL
4. (Опционально) Настройте OAuth провайдеры

**Нужна помощь?** См. [SERVER_COMMANDS.md](./SERVER_COMMANDS.md)

---

**Приятного использования! 🚀**
