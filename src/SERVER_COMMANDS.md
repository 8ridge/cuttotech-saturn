# 🖥️ Шпаргалка команд для Ubuntu сервера

Быстрый справочник по командам для управления URL Shortener на Ubuntu сервере.

---

## 🚀 PM2 - Управление процессами

### Основные команды

```bash
# Просмотр статуса всех приложений
pm2 status

# Просмотр статуса конкретного приложения
pm2 show url-shortener

# Просмотр логов в реальном времени
pm2 logs url-shortener

# Просмотр последних 100 строк логов
pm2 logs url-shortener --lines 100

# Очистить логи
pm2 flush
```

### Управление приложением

```bash
# Перезапуск
pm2 restart url-shortener

# Остановка
pm2 stop url-shortener

# Запуск
pm2 start url-shortener

# Удаление из PM2
pm2 delete url-shortener

# Запуск с нуля (если удалили)
pm2 start npm --name "url-shortener" -- run preview -- --host 0.0.0.0 --port 3000
```

### Автозапуск

```bash
# Настройка автозапуска при перезагрузке системы
pm2 startup

# Сохранить текущий список процессов
pm2 save

# Воскресить сохраненные процессы
pm2 resurrect
```

### Мониторинг

```bash
# Интерактивный мониторинг ресурсов
pm2 monit

# Детальная информация о процессе
pm2 describe url-shortener
```

---

## 📦 NPM - Управление пакетами

### Установка и обновление

```bash
# Установка зависимостей
cd ~/url-shortener
npm install

# Обновление одного пакета
npm update имя-пакета

# Обновление всех пакетов
npm update

# Проверка устаревших пакетов
npm outdated
```

### Сборка проекта

```bash
# Production сборка
npm run build

# Development режим (локально)
npm run dev

# Preview режим (просмотр production сборки)
npm run preview
```

---

## 🔥 UFW - Управление файрволом

### Просмотр правил

```bash
# Статус файрвола
sudo ufw status

# Статус с номерами правил
sudo ufw status numbered

# Детальный статус
sudo ufw status verbose
```

### Управление портами

```bash
# Открыть порт 3000
sudo ufw allow 3000/tcp

# Закрыть порт 3000
sudo ufw delete allow 3000/tcp

# Открыть порт только для конкретного IP
sudo ufw allow from 192.168.1.100 to any port 3000

# Открыть SSH (важно!)
sudo ufw allow 22/tcp
```

### Включение/выключение

```bash
# Включить файрвол
sudo ufw enable

# Выключить файрвол
sudo ufw disable

# Перезагрузить файрвол
sudo ufw reload
```

---

## 🌐 Сетевые команды

### Проверка портов

```bash
# Проверить какие порты слушаются
sudo netstat -tlnp

# Проверить конкретный порт
sudo lsof -i :3000

# Показать процесс на порту 3000
sudo ss -tlnp | grep :3000
```

### Проверка подключения

```bash
# Проверить доступность локально
curl http://localhost:3000

# Проверить доступность извне
curl http://ваш-ip:3000

# Проверить с заголовками
curl -I http://ваш-ip:3000
```

### Получить IP адрес

```bash
# Локальный IP
hostname -I

# Внешний IP
curl ifconfig.me

# Все сетевые интерфейсы
ip addr show
```

---

## 🔄 Git - Управление кодом

### Обновление проекта

```bash
cd ~/url-shortener

# Получить обновления
git pull origin main

# Принудительно перезаписать локальные изменения
git fetch --all
git reset --hard origin/main

# Просмотр изменений
git status
git log --oneline -10
```

### Сохранение изменений

```bash
# Добавить все изменения
git add .

# Коммит
git commit -m "Описание изменений"

# Отправить на сервер
git push origin main
```

---

## 🗄️ Системные команды

### Дисковое пространство

```bash
# Проверка свободного места
df -h

# Размер директории проекта
du -sh ~/url-shortener

# Размер node_modules
du -sh ~/url-shortener/node_modules
```

### Память и процессор

```bash
# Использование памяти
free -h

# Процессы по использованию памяти
top -o %MEM

# Процессы по использованию CPU
top -o %CPU

# Упрощенная версия htop (если установлен)
htop
```

### Логи системы

```bash
# Системные логи
sudo journalctl -xe

# Логи за последний час
sudo journalctl --since "1 hour ago"

# Логи конкретного сервиса
sudo journalctl -u nginx
```

---

## 🛠️ Обслуживание

### Очистка

```bash
# Очистка кеша npm
npm cache clean --force

# Удаление node_modules и переустановка
cd ~/url-shortener
rm -rf node_modules package-lock.json
npm install

# Очистка логов PM2
pm2 flush

# Очистка старых логов системы
sudo journalctl --vacuum-time=7d
```

### Обновление системы

```bash
# Обновление пакетов
sudo apt update
sudo apt upgrade -y

# Обновление только security патчей
sudo apt update
sudo apt upgrade -y --only-upgrade

# Очистка старых пакетов
sudo apt autoremove -y
sudo apt autoclean
```

---

## 🔍 Диагностика проблем

### Приложение не запускается

```bash
# 1. Проверить логи PM2
pm2 logs url-shortener --lines 50

# 2. Проверить процессы на порту 3000
sudo lsof -i :3000

# 3. Убить процесс (если порт занят)
sudo kill -9 $(sudo lsof -t -i:3000)

# 4. Запустить заново
pm2 restart url-shortener
```

### Приложение недоступно извне

```bash
# 1. Проверить файрвол
sudo ufw status

# 2. Проверить что приложение слушает 0.0.0.0
sudo netstat -tlnp | grep 3000

# 3. Проверить доступность локально
curl http://localhost:3000

# 4. Проверить безопасность группы (AWS/DigitalOcean)
# Это делается в веб-консоли провайдера
```

### Ошибки при сборке

```bash
# 1. Очистить кеш и переустановить
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 2. Проверить версию Node.js
node --version  # Должно быть v20.x.x

# 3. Пересобрать
npm run build
```

---

## 📝 Типичные сценарии

### Обновление кода и перезапуск

```bash
cd ~/url-shortener
git pull origin main
npm install
npm run build
pm2 restart url-shortener
```

### Просмотр логов в реальном времени

```bash
pm2 logs url-shortener --lines 0
# Нажмите Ctrl+C для выхода
```

### Проверка здоровья системы

```bash
# Статус приложения
pm2 status

# Использование ресурсов
pm2 monit
# или
htop

# Свободное место
df -h

# Проверка доступности
curl http://localhost:3000
```

### Полная остановка и запуск

```bash
# Остановка
pm2 stop url-shortener

# Запуск
pm2 start url-shortener

# Или перезапуск
pm2 restart url-shortener
```

---

## ⚡ Быстрые команды (one-liners)

```bash
# Перезапуск после обновления кода
cd ~/url-shortener && git pull && npm install && npm run build && pm2 restart url-shortener

# Проверка всего стека
pm2 status && sudo ufw status && df -h && free -h

# Открыть порт 3000
sudo ufw allow 3000/tcp && sudo ufw reload

# Очистить все и переустановить
cd ~/url-shortener && rm -rf node_modules package-lock.json && npm cache clean --force && npm install && npm run build

# Получить IP адреса
echo "Локальный: $(hostname -I | awk '{print $1}')" && echo "Внешний: $(curl -s ifconfig.me)"
```

---

## 🎓 Полезные алиасы

Добавьте в `~/.bashrc` для удобства:

```bash
# Откройте файл
nano ~/.bashrc

# Добавьте в конец:
alias pm2-url='pm2 logs url-shortener'
alias pm2-status='pm2 status'
alias url-update='cd ~/url-shortener && git pull && npm install && npm run build && pm2 restart url-shortener'
alias url-logs='pm2 logs url-shortener'
alias url-restart='pm2 restart url-shortener'

# Сохраните: Ctrl+O, Enter, Ctrl+X

# Примените изменения
source ~/.bashrc
```

Теперь можно использовать короткие команды:
```bash
pm2-url          # Логи
url-update       # Обновить и перезапустить
url-restart      # Перезапуск
```

---

## 📚 Дополнительные ресурсы

- **PM2 документация**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **UFW документация**: https://help.ubuntu.com/community/UFW
- **Node.js документация**: https://nodejs.org/docs/

---

**Сохраните этот файл для быстрого доступа!** 📌
