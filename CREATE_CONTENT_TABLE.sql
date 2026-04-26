-- ============================================
-- СОЗДАНИЕ ТАБЛИЦЫ CONTENT
-- ============================================
-- Выполните этот SQL в Supabase SQL Editor

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

-- Индекс для быстрого поиска по категориям
CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
CREATE INDEX IF NOT EXISTS idx_content_key ON content(key);

-- RLS политики
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Удаляем ВСЕ существующие политики для таблицы content (если есть)
-- Это нужно сделать ПЕРЕД созданием новых политик
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Удаляем все политики по одной (включая те, что могут иметь другие названия)
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'content' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON content', r.policyname);
  END LOOP;
END $$;

-- Теперь создаем политики заново
-- Все могут читать контент
CREATE POLICY "Контент доступен для чтения всем"
  ON content FOR SELECT
  USING (true);

-- Только администраторы могут редактировать
-- ⚠️ ВАЖНО: Замените 'ilnar.nabiev81@gmail.com' на email вашего админа
CREATE POLICY "Только администраторы могут редактировать контент"
  ON content FOR ALL
  USING (
    auth.jwt() ->> 'email' = 'ilnar.nabiev81@gmail.com'
  )
  WITH CHECK (
    auth.jwt() ->> 'email' = 'ilnar.nabiev81@gmail.com'
  );

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старый триггер если существует
DROP TRIGGER IF EXISTS update_content_updated_at ON content;

CREATE TRIGGER update_content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ⚠️ ВАЖНО: Даем права на таблицу (необходимо для PostgREST и Edge Functions)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE content TO anon, authenticated;
GRANT ALL ON TABLE content TO authenticated, service_role;

-- ⚠️ ВАЖНО: Принудительно обновляем кэш схемы PostgREST
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- Проверка: таблица должна существовать
SELECT 'Таблица content создана успешно!' as status, 
       COUNT(*) as row_count,
       'Если видите эту строку - таблица существует' as note
FROM content;

-- Дополнительная проверка схемы
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'content' AND table_schema = 'public';











