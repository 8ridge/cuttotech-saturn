# ⚡ Быстрый старт за 5 минут

Самый быстрый способ запустить URL Shortener локально.

---

## 🎯 Что вам нужно

- ✅ Node.js 18+ ([скачать](https://nodejs.org/))
- ✅ 5 минут времени
- ✅ Бесплатный аккаунт Supabase ([создать](https://supabase.com))

---

## 🚀 Шаги установки

### 1️⃣ Установите зависимости

```bash
npm install
```

### 2️⃣ Создайте проект в Supabase

1. Перейдите на [supabase.com](https://supabase.com) → **New Project**
2. Дождитесь создания (2-3 минуты)
3. Перейдите в **Settings → API**
4. Скопируйте:
   - **Project ID** (из URL: `https://XXXXX.supabase.co`)
   - **anon public key**

### 3️⃣ Настройте конфигурацию

Откройте `/utils/supabase/info.tsx` и замените:

```typescript
export const projectId = 'ВАШ_PROJECT_ID';
export const publicAnonKey = 'ВАШ_ANON_KEY';
```

### 4️⃣ Обновите Supabase клиент

Установите SDK:
```bash
npm install @supabase/supabase-js
```

Замените содержимое `/utils/supabase/client.ts`:

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

### 5️⃣ Настройте базу данных

В **Supabase Dashboard → SQL Editor** выполните:

```sql
-- Таблица для контента
CREATE TABLE IF NOT EXISTS content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
CREATE INDEX IF NOT EXISTS idx_content_key ON content(key);

-- RLS политики
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Контент доступен для чтения всем"
  ON content FOR SELECT
  USING (true);

-- Вставьте начальные данные
INSERT INTO content (key, value, category, description) VALUES
('home.hero.title', 'Превратите длинные ссылки в мощный инструмент маркетинга', 'home', 'Главный заголовок'),
('header.logo', 'ShortURL', 'header', 'Название сервиса')
ON CONFLICT (key) DO NOTHING;
```

### 6️⃣ Запустите приложение

```bash
npm run dev
```

Откройте: **http://localhost:3000** 🎉

---

## ✅ Что дальше?

### Просмотр production build

```bash
npm run build
npm run preview
```

### Полная настройка

Для полной инструкции см. **[INSTALLATION.md](./INSTALLATION.md)**

### Развертывание

Для деплоя на production см. **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

### Настройка администратора

1. Зарегистрируйтесь в приложении
2. Получите User ID из **Supabase → Authentication → Users**
3. В SQL Editor выполните:

```sql
-- Замените на ваш email
DROP POLICY IF EXISTS "Только администраторы могут редактировать контент" ON content;

CREATE POLICY "Только администраторы могут редактировать контент"
  ON content FOR ALL
  USING (auth.jwt() ->> 'email' = 'ваш-email@example.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'ваш-email@example.com');
```

Теперь у вас есть доступ к админ-панели! 🎨

---

## 🆘 Проблемы?

### Не устанавливаются зависимости

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Не видно текстов

1. Проверьте консоль браузера (F12)
2. Убедитесь, что SQL скрипт выполнен
3. Проверьте Supabase credentials

### Порт 3000 занят

В `vite.config.ts` измените:
```typescript
server: {
  port: 3001, // Или другой порт
}
```

---

## 📚 Документация

- **[INSTALLATION.md](./INSTALLATION.md)** - Полная инструкция по установке
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Деплой на production
- **[DOCS_INDEX.md](./DOCS_INDEX.md)** - Вся документация

---

**Готово! Наслаждайтесь разработкой! 🚀**
