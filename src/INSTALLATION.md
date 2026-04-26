# 📦 Инструкция по установке URL Shortener

Простая пошаговая инструкция для локальной разработки и просмотра дизайна.

---

## 🎯 Что вы получите после установки

После выполнения всех шагов вы сможете:
- ✅ Запустить приложение локально
- ✅ Увидеть полный дизайн сайта
- ✅ Протестировать все функции
- ✅ Редактировать тексты через админ-панель (CMS)

---

## 📋 Предварительные требования

Убедитесь, что у вас установлено:

- **Node.js 18+** ([скачать](https://nodejs.org/))
- **npm** (устанавливается вместе с Node.js)
- **Аккаунт Supabase** (бесплатный) - [создать](https://supabase.com)

---

## 🚀 Установка

### Шаг 1: Создание проекта в Supabase

1. Перейдите на [supabase.com](https://supabase.com) и войдите в аккаунт
2. Нажмите **"New Project"**
3. Заполните данные:
   - **Project Name**: `url-shortener` (или любое другое)
   - **Database Password**: придумайте надежный пароль
   - **Region**: выберите ближайший регион
4. Нажмите **"Create new project"**
5. Дождитесь создания проекта (2-3 минуты)

### Шаг 2: Получение учетных данных Supabase

1. После создания проекта перейдите в **Settings → API**
2. Скопируйте следующие данные:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project ID**: `xxxxx` (из URL)
   - **anon public key**: начинается с `eyJhbGc...`

### Шаг 3: Установка зависимостей

Откройте терминал в директории проекта и выполните:

```bash
npm install
```

### Шаг 4: Настройка Supabase в проекте

Откройте файл `/utils/supabase/info.tsx` и замените значения на ваши:

```typescript
// Supabase project configuration
export const projectId = 'ваш-project-id';
export const publicAnonKey = 'ваш-anon-key';
```

**Пример:**
```typescript
export const projectId = 'abcdefghijklmnop';
export const publicAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Шаг 5: Обновление Supabase клиента

Откройте файл `/utils/supabase/client.ts` и замените его содержимое на:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface SupabaseClient {
  auth: any;
  from: (table: string) => any;
}

export function createClient(url: string, key: string): SupabaseClient {
  return createSupabaseClient(url, key) as any;
}
```

Затем установите Supabase SDK:

```bash
npm install @supabase/supabase-js
```

### Шаг 6: Настройка базы данных

#### 6.1 Создание таблицы для контента (CMS)

1. Перейдите в **Supabase Dashboard → SQL Editor**
2. Скопируйте и выполните следующий SQL-скрипт:

```sql
-- Создание таблицы для хранения контента
CREATE TABLE IF NOT EXISTS content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
CREATE INDEX IF NOT EXISTS idx_content_key ON content(key);

-- RLS политики
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Все могут читать контент
CREATE POLICY "Контент доступен для чтения всем"
  ON content FOR SELECT
  USING (true);

-- Только администраторы могут редактировать
-- ВАЖНО: Замените 'admin@yourdomain.com' на ваш email после регистрации
CREATE POLICY "Только администраторы могут редактировать контент"
  ON content FOR ALL
  USING (
    auth.jwt() ->> 'email' = 'admin@yourdomain.com'
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'admin@yourdomain.com'
  );

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### 6.2 Добавление начальных данных

Выполните следующий SQL-скрипт в **SQL Editor**:

```sql
-- Главная страница - Hero секция
INSERT INTO content (key, value, category, description) VALUES
('home.hero.badge', 'Современный сервис сокращения ссылок', 'home', 'Значок над заголовком hero секции'),
('home.hero.title', 'Превратите длинные ссылки в мощный инструмент маркетинга', 'home', 'Главный заголовок hero секции'),
('home.hero.subtitle', 'Создавайте короткие ссылки, отслеживайте каждый клик и принимайте решения на основе данных', 'home', 'Подзаголовок hero секции'),

-- Главная - Преимущества
('home.why.title', 'Почему выбирают наш сервис?', 'home', 'Заголовок секции преимуществ'),
('home.why.subtitle', 'Мы предлагаем больше, чем просто сокращение ссылок', 'home', 'Подзаголовок секции преимуществ'),
('home.why.analytics.title', 'Детальная аналитика', 'home', 'Заголовок карточки аналитики'),
('home.why.analytics.description', 'Отслеживайте каждый клик с информацией о геолокации, устройствах, браузерах и источниках трафика', 'home', 'Описание аналитики'),

-- Хедер
('header.logo', 'ShortURL', 'header', 'Название сервиса в логотипе'),
('header.login', 'Войти / Регистрация', 'header', 'Текст кнопки входа'),

-- Dashboard
('dashboard.title', 'Личный кабинет', 'dashboard', 'Заголовок дашборда'),
('dashboard.subtitle', 'Управляйте своими ссылками и отслеживайте статистику', 'dashboard', 'Подзаголовок дашборда')

ON CONFLICT (key) DO NOTHING;
```

Полный список текстов см. в файле `/CONTENT_SETUP.md`.

### Шаг 7: Сборка проекта

```bash
npm run build
```

### Шаг 8: Запуск локального сервера

```bash
npm run dev
```

Приложение будет доступно по адресу: **http://localhost:3000**

---

## ✅ Проверка установки

После запуска откройте браузер и перейдите по адресу `http://localhost:3000`

Вы должны увидеть:
- ✅ Красивую главную страницу с формой создания ссылок
- ✅ Заголовок "ShortURL" в шапке
- ✅ Кнопку "Войти / Регистрация"
- ✅ Все тексты загруженные из Supabase

---

## 🎨 Просмотр дизайна

### Production build

Чтобы увидеть финальную версию дизайна:

1. Соберите проект:
```bash
npm run build
```

2. Запустите preview сервер:
```bash
npm run preview
```

3. Откройте браузер по указанному адресу (обычно `http://localhost:4173`)

---

## 👤 Настройка администратора

Чтобы получить доступ к админ-панели и редактированию контента:

### Шаг 1: Регистрация первого пользователя

1. Откройте приложение в браузере
2. Нажмите **"Войти / Регистрация"**
3. Перейдите на вкладку **"Регистрация"**
4. Зарегистрируйтесь с вашим email

### Шаг 2: Получение User ID

1. Перейдите в **Supabase Dashboard → Authentication → Users**
2. Найдите вашего пользователя
3. Скопируйте **User ID** (формат: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Шаг 3: Обновление RLS политики

1. Откройте **Supabase Dashboard → SQL Editor**
2. Выполните SQL для обновления политики:

```sql
-- Удалите старую политику
DROP POLICY IF EXISTS "Только администраторы могут редактировать контент" ON content;

-- Создайте новую с вашим email
CREATE POLICY "Только администраторы могут редактировать контент"
  ON content FOR ALL
  USING (
    auth.jwt() ->> 'email' = 'ваш-email@example.com'
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'ваш-email@example.com'
  );
```

Замените `'ваш-email@example.com'` на email, который вы использовали при регистрации.

### Шаг 4: Проверка доступа

1. Перезагрузите страницу в браузере
2. В шапке должна появиться кнопка **"Admin"**
3. Нажмите на нее, чтобы открыть админ-панель
4. Перейдите на вкладку **"Управление контентом"**
5. Теперь вы можете редактировать все тексты на сайте!

---

## 📝 Редактирование текстов (CMS)

После настройки администратора вы можете:

1. Войти в **Админ-панель** → **Управление контентом**
2. Выбрать категорию (Home, Header, Dashboard и т.д.)
3. Нажать на текст, который хотите изменить
4. Ввести новое значение
5. Изменения применяются мгновенно!

**Никакой пересборки приложения не требуется** - все тексты загружаются из базы данных.

---

## 🛠 Полезные команды

```bash
# Запуск dev сервера
npm run dev

# Сборка production версии
npm run build

# Просмотр production build
npm run preview

# Установка зависимостей
npm install

# Проверка кода
npm run lint
```

---

## 📚 Дополнительная информация

### Документация проекта

- `/README.md` - Общее описание проекта
- `/ARCHITECTURE.md` - Архитектура приложения
- `/CONTENT_SETUP.md` - Полная настройка CMS
- `/CMS_README.md` - Руководство по использованию CMS
- `/Attributions.md` - Лицензии и авторские права

### Настройка для production

Для развертывания на сервере см. отдельный документ:
- `/DEPLOYMENT_GUIDE.md` - Полная инструкция по развертыванию

---

## ❓ Troubleshooting

### Проблема: Не устанавливаются зависимости

**Решение:**
```bash
# Очистите кеш npm
npm cache clean --force

# Удалите node_modules и package-lock.json
rm -rf node_modules package-lock.json

# Переустановите зависимости
npm install
```

### Проблема: Не видно текстов из базы данных

**Решение:**
1. Проверьте, что вы выполнили SQL-скрипты из Шага 6
2. Проверьте консоль браузера (F12) на наличие ошибок
3. Убедитесь, что Supabase URL и ключ указаны правильно

### Проблема: После npm run build не работает локально

**Решение:**
Используйте `npm run preview` вместо прямого открытия index.html

### Проблема: Ошибка при запуске dev сервера

**Решение:**
1. Проверьте, что порт 3000 свободен
2. Попробуйте изменить порт в `vite.config.ts`
3. Перезапустите терминал

---

## 🎉 Готово!

После выполнения всех шагов у вас должен быть полностью рабочий URL Shortener с:

- ✅ Красивым современным дизайном
- ✅ Системой управления контентом (CMS)
- ✅ Админ-панелью
- ✅ Возможностью редактировать все тексты без пересборки

**Наслаждайтесь разработкой! 🚀**

---

## 💡 Следующие шаги

1. Изучите код в `/components` для понимания структуры
2. Настройте OAuth провайдеры (Google, Facebook) в Supabase
3. Добавьте свои тексты через админ-панель
4. Кастомизируйте дизайн под свой бренд
5. Разверните на production сервер (см. `/DEPLOYMENT_GUIDE.md`)

---

**Нужна помощь?** Проверьте существующую документацию или создайте Issue в репозитории.
