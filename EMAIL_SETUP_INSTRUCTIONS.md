# 📧 Инструкция по настройке Email функциональности

## ✅ Что было реализовано

1. **Проверка существования email** при регистрации
2. **Отправка письма с подтверждением** при регистрации
3. **Подтверждение email** по ссылке из письма
4. **Восстановление пароля** (Forgot Password)
5. **Кнопки показа/скрытия пароля** на формах входа и регистрации

---

## 🔧 Настройка

### 1. Установка зависимостей

Зависимости уже установлены:
- `nodemailer` - для отправки email (альтернатива)
- `resend` - основной сервис для отправки email (рекомендуется)

### 2. Настройка Resend (рекомендуется)

1. Зарегистрируйтесь на [Resend.com](https://resend.com)
2. Создайте API ключ в Dashboard
3. Добавьте домен (или используйте тестовый домен)
4. Получите API ключ

### 3. Настройка переменных окружения

Добавьте в `server/.env`:

```env
# Email Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=CutToTech <noreply@cutto.tech>
BASE_URL=https://cutto.tech
FRONTEND_URL=https://cutto.tech
```

**Важно:**
- `RESEND_API_KEY` - ваш API ключ от Resend
- `EMAIL_FROM` - адрес отправителя (должен быть верифицирован в Resend)
- `BASE_URL` - URL вашего сайта для ссылок в письмах

### 4. Применение миграции базы данных

Выполните SQL миграцию для создания таблицы токенов:

```bash
cd /home/ci97979/www/CutToTech-email/server
psql -U urlshortener -d urlshortener -f migrations/add_email_tokens.sql
```

Или вручную через psql:

```sql
-- Подключитесь к базе данных
psql -U urlshortener -d urlshortener

-- Выполните SQL из файла migrations/add_email_tokens.sql
```

### 5. Перезапуск сервера

```bash
cd /home/ci97979/www/CutToTech-email/server
npm start
```

---

## 📋 API Endpoints

### POST /signup
Регистрация с проверкой email и отправкой письма подтверждения.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful! Please check your email to verify your account.",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "email_verified": false
  },
  "access_token": "..."
}
```

### GET /verify-email?token=xxx
Подтверждение email по токену из письма.

**Redirect:** Перенаправляет на главную страницу с параметром `?emailVerified=true`

### POST /forgot-password
Запрос на сброс пароля.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

### POST /reset-password
Сброс пароля по токену.

**Request:**
```json
{
  "token": "xxx",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

### POST /resend-verification
Повторная отправка письма подтверждения (требует авторизации).

**Headers:**
```
Authorization: Bearer <token>
```

---

## 🎨 Фронтенд изменения

### AuthModal.tsx
- ✅ Добавлены кнопки показа/скрытия пароля
- ✅ Добавлена форма "Forgot Password"
- ✅ Обработка успешной регистрации с сообщением о проверке email

### ResetPassword.tsx
- ✅ Новый компонент для страницы сброса пароля
- ✅ Валидация пароля
- ✅ Кнопки показа/скрытия пароля

### App.tsx
- ✅ Обработка параметра `emailVerified=true` в URL
- ✅ Роутинг для `/reset-password`

---

## 📝 Проверка работы

### 1. Регистрация
1. Зарегистрируйтесь с новым email
2. Проверьте почту - должно прийти письмо с подтверждением
3. Нажмите на ссылку в письме
4. Должно появиться сообщение об успешном подтверждении

### 2. Восстановление пароля
1. На странице входа нажмите "Forgot password?"
2. Введите email
3. Проверьте почту - должно прийти письмо со ссылкой сброса
4. Перейдите по ссылке
5. Введите новый пароль
6. Войдите с новым паролем

### 3. Кнопки показа пароля
1. На формах входа и регистрации должны быть иконки глаза
2. При нажатии пароль должен показываться/скрываться

---

## ⚠️ Важные замечания

1. **Resend бесплатный тариф:**
   - 100 писем в день
   - 3000 писем в месяц
   - Для production может потребоваться платный план

2. **Проверка email:**
   - Сейчас используется базовая проверка формата
   - Для production можно добавить проверку через API (EmailListVerify, Abstract API)

3. **Токены:**
   - Токены подтверждения email действительны 24 часа
   - Токены сброса пароля действительны 1 час
   - Использованные токены помечаются как `used` и не могут быть использованы повторно

4. **Безопасность:**
   - Всегда возвращаем одинаковый ответ для `/forgot-password` (не раскрываем, существует ли email)
   - Токены генерируются криптографически стойким способом
   - Пароли хешируются с bcrypt

---

## 🐛 Решение проблем

### Письма не отправляются
1. Проверьте `RESEND_API_KEY` в `.env`
2. Проверьте логи сервера на ошибки
3. Убедитесь, что домен верифицирован в Resend
4. Проверьте лимиты бесплатного тарифа

### Токены не работают
1. Проверьте, что миграция базы данных применена
2. Проверьте, что таблица `email_tokens` создана
3. Проверьте логи сервера

### Страница reset-password не открывается
1. Убедитесь, что компонент `ResetPassword.tsx` создан
2. Проверьте роутинг в `App.tsx`
3. Проверьте, что сервер правильно обрабатывает `/reset-password`

---

## 📚 Дополнительные ресурсы

- [Resend Documentation](https://resend.com/docs)
- [Resend Dashboard](https://resend.com/dashboard)

---

**Готово!** Все функции email реализованы и готовы к использованию. 🎉


