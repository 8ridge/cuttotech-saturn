# Быстрый старт: Система управления контентом

## 3 шага для начала работы

### 1️⃣ Создайте таблицу в Supabase

Откройте **Supabase Dashboard** → **SQL Editor** и выполните:

```sql
-- Создание таблицы
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

-- RLS
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Все могут читать
CREATE POLICY "Контент доступен для чтения всем"
  ON content FOR SELECT USING (true);

-- ⚠️ ЗАМЕНИТЕ admin@yourdomain.com на ваш email админа!
CREATE POLICY "Только администраторы могут редактировать контент"
  ON content FOR ALL
  USING (auth.jwt() ->> 'email' = 'admin@yourdomain.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@yourdomain.com');

-- Триггер обновления времени
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

### 2️⃣ Добавьте начальные данные

Выполните SQL из файла **CONTENT_SETUP.md** (раздел "Добавление начальных данных").
Или используйте минимальный набор:

```sql
INSERT INTO content (key, value, category, description) VALUES
('header.logo', 'ShortURL', 'header', 'Название сервиса'),
('home.hero.title', 'Превратите длинные ссылки в мощный инструмент маркетинга', 'home', 'Главный заголовок'),
('home.hero.subtitle', 'Создавайте короткие ссылки, отслеживайте каждый клик и принимайте решения на основе данных', 'home', 'Подзаголовок')
ON CONFLICT (key) DO NOTHING;
```

### 3️⃣ Настройте email администратора

**В коде:** Откройте `/components/Header.tsx` и замените:
```typescript
const isAdmin = user?.email === 'admin@yourdomain.com';
```
На свой email, например:
```typescript
const isAdmin = user?.email === 'myemail@example.com';
```

**В Supabase:** Email должен совпадать с тем, что указан в RLS политике (шаг 1).

---

## ✅ Готово!

Теперь:
1. Войдите на сайт под своей учетной записью администратора
2. В хедере появится кнопка **"Админ"**
3. Откройте **Управление контентом**
4. Редактируйте любые тексты на сайте в реальном времени!

## 🎯 Что дальше?

- Полная документация: `CONTENT_MANAGEMENT_GUIDE.md`
- Детальная настройка: `CONTENT_SETUP.md`

## ❓ Не работает?

**Проверьте:**
- ✅ Таблица `content` создана в Supabase
- ✅ Email администратора совпадает в коде и RLS политике
- ✅ Вы вошли под учетной записью администратора
- ✅ В консоли браузера нет ошибок

**Если таблица не создана:**
Приложение продолжит работать с текстами по умолчанию из кода (fallback mode).
