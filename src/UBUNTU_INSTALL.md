# Установка на Ubuntu 22 Server

Простая инструкция по установке и запуску проекта на Ubuntu 22.04 сервере.

## 📋 Требования

- Ubuntu 22.04 Server
- Открытый порт 3000 (или другой по вашему выбору)
- Доступ по SSH к серверу

## 🚀 Быстрая установка

### Шаг 1: Скачайте проект на сервер

**Вариант A: Через Git (рекомендуется)**
```bash
# Установите git если его нет
sudo apt install git -y

# Клонируйте проект
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> url-shortener
cd url-shortener
```

**Вариант B: Через ZIP файл**
```bash
# Скачайте ZIP на локальный компьютер через кнопку "Code" → "Download ZIP"
# Загрузите на сервер через scp:
# scp url-shortener.zip user@your-server:/home/user/

# На сервере распакуйте:
sudo apt install unzip -y
unzip url-shortener.zip
cd url-shortener
```

### Шаг 2: Установите Node.js

```bash
# Установка Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверьте установку
node --version   # должно показать v20.x.x
npm --version    # должно показать 10.x.x
```

### Шаг 3: Настройте Supabase

1. Откройте файл `utils/supabase/info.tsx`
2. Замените значения на ваши данные из Supabase:

```bash
nano utils/supabase/info.tsx
```

Измените:
```typescript
export const projectId = "ваш-project-id";
export const publicAnonKey = "ваш-anon-key";
```

Сохраните: `Ctrl + O`, `Enter`, `Ctrl + X`

### Шаг 4: Установите зависимости

```bash
npm install
```

### Шаг 5: Запустите проект

**Для разработки (с hot reload):**
```bash
npm run dev -- --host 0.0.0.0 --port 3000
```

**Для продакшена (��екомендуется):**
```bash
# Соберите проект
npm run build

# Запустите preview server
npm run preview -- --host 0.0.0.0 --port 3000
```

Сайт будет доступен по адресу: `http://ваш-ip:3000`

## 🔄 Автозапуск через systemd

Чтобы сайт запускался автоматически при перезагрузке сервера:

### 1. Создайте systemd service

```bash
sudo nano /etc/systemd/system/url-shortener.service
```

Вставьте (замените `/home/user/url-shortener` на ваш путь):

```ini
[Unit]
Description=URL Shortener Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/user/url-shortener
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port 3000
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Замените:**
- `your-username` на ваше имя пользователя
- `/home/user/url-shortener` на полный путь к проекту

### 2. Активируйте service

```bash
# Перезагрузите systemd
sudo systemctl daemon-reload

# Включите автозапуск
sudo systemctl enable url-shortener

# Запустите сервис
sudo systemctl start url-shortener

# Проверьте статус
sudo systemctl status url-shortener
```

## 📝 Полезные команды

### Управление сервисом

```bash
# Запуск
sudo systemctl start url-shortener

# Остановка
sudo systemctl stop url-shortener

# Перезапуск
sudo systemctl restart url-shortener

# Статус
sudo systemctl status url-shortener

# Логи
sudo journalctl -u url-shortener -f
```

### Обновление проекта

```bash
# Остановите сервис
sudo systemctl stop url-shortener

# Обновите код
cd /home/user/url-shortener
git pull  # если используете git

# Переустановите зависимости (если обновился package.json)
npm install

# Пересоберите проект
npm run build

# Запустите сервис
sudo systemctl start url-shortener
```

## 🌐 Настройка Nginx (опционально)

Если хотите использовать домен и SSL:

### 1. Установите Nginx

```bash
sudo apt install nginx -y
```

### 2. Создайте конфигурацию

```bash
sudo nano /etc/nginx/sites-available/url-shortener
```

Вставьте:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Активируйте конфигурацию

```bash
# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/url-shortener /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

### 4. Установите SSL (опционально)

```bash
# Установите Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получите SSL сертификат
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 🔥 Firewall

Откройте необходимые порты:

```bash
# Если используете ufw
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## ❗ Решение проблем

### Проблема: "npm: command not found"
```bash
# Переустановите Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Проблема: "Permission denied" при установке
```bash
# Используйте sudo для установки пакетов
sudo npm install -g npm@latest
```

### Проблема: Порт 3000 уже занят
```bash
# Найдите процесс
sudo lsof -i :3000

# Убейте процесс (замените PID)
sudo kill -9 PID

# Или используйте другой порт
npm run preview -- --host 0.0.0.0 --port 4000
```

### Проблема: Сайт недоступен извне
```bash
# Проверьте firewall
sudo ufw status

# Откройте порт
sudo ufw allow 3000/tcp

# Проверьте, слушает ли приложение на 0.0.0.0
sudo netstat -tulpn | grep 3000
```

## 📊 Проверка работы

1. Проверьте доступность сайта:
   ```bash
   curl http://localhost:3000
   ```

2. Проверьте логи:
   ```bash
   sudo journalctl -u url-shortener -f
   ```

3. Проверьте статус:
   ```bash
   sudo systemctl status url-shortener
   ```

## 🎯 Готово!

Ваш URL Shortener должен работать и быть доступен по адресу:
- Напрямую: `http://ваш-ip:3000`
- Через Nginx: `http://your-domain.com`

---

**Нужна помощь?** Проверьте логи: `sudo journalctl -u url-shortener -f`
