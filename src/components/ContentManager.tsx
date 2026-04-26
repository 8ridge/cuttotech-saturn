import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { RefreshCw, Search, Edit, Check, X, AlertCircle, FileText, Copy } from './icons';
interface ContentItem {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  updated_at: string;
}

interface ContentManagerProps {
  onContentUpdated: () => void;
  user?: any; // User object with access_token
}

export default function ContentManager({ onContentUpdated, user }: ContentManagerProps) {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tableError, setTableError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  const loadContent = async () => {
    // Prevent multiple simultaneous requests
    if (loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;

    setLoading(true);
    setTableError(null);
    try {
      // Use local API server
      // GET /admin/content is public (no auth required for reading)
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(
        getApiUrl('admin/content'),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Only send token if user is authenticated (for write operations)
            ...(user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          setTableError('UNAUTHORIZED');
          toast.error('Требуется авторизация администратора');
        } else {
          setTableError('OTHER_ERROR');
          toast.error('Ошибка загрузки контента: ' + (result.error || 'Неизвестная ошибка'));
        }
        console.error('Content load error:', result);
        return;
      }

      const result = await response.json();

      // Success - got data
      setContent(result.content || []);
      setTableError(null);
      if (result.content && result.content.length === 0) {
        toast.info('Таблица создана, но пуста. Добавьте данные через SQL или начните редактировать.');
      }
    } catch (error: any) {
      // Only show error if it's not a network error (to avoid spam)
      if (error.name !== 'TypeError' || !error.message.includes('Failed to fetch')) {
        console.error('Load content error:', error);
        setTableError('CONNECTION_ERROR');
        toast.error('Ошибка подключения к серверу: ' + (error?.message || 'Неизвестная ошибка'));
      } else {
        // Network error - set error state but don't spam console
        setTableError('CONNECTION_ERROR');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    // Only load once when component mounts
    mountedRef.current = true;
    
    if (mountedRef.current && user?.access_token) {
      loadContent();
    }

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const copySQLScript = () => {
    const sqlScript = `-- Создание таблицы для хранения контента
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
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Удаляем политики чтения
  DROP POLICY IF EXISTS "Контент доступен для чтения всем" ON content;
  DROP POLICY IF EXISTS "content_select_policy" ON content;
  DROP POLICY IF EXISTS "Everyone can read content" ON content;
  
  -- Удаляем политики редактирования
  DROP POLICY IF EXISTS "Только администраторы могут редактировать контент" ON content;
  DROP POLICY IF EXISTS "content_admin_policy" ON content;
  DROP POLICY IF EXISTS "Only admins can edit content" ON content;
  
  -- Удаляем все остальные политики (на случай, если названия другие)
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'content' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON content', r.policyname);
  END LOOP;
END $$;

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

-- ⚠️ ВАЖНО: Даем права на таблицу (необходимо для PostgREST)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE content TO anon, authenticated;
GRANT ALL ON TABLE content TO authenticated, service_role;

-- ⚠️ ВАЖНО: Принудительно обновляем кэш схемы PostgREST
-- Используем NOTIFY вместо SELECT pg_notify (более надежно)
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
WHERE table_name = 'content' AND table_schema = 'public';`;

    // Try to copy to clipboard with fallback
    const copyToClipboard = async () => {
      try {
        // Modern clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(sqlScript);
          toast.success('SQL скрипт скопирован в буфер обмена!');
          return;
        }
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = sqlScript;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            toast.success('SQL скрипт скопирован в буфер обмена!');
          } else {
            throw new Error('execCommand failed');
          }
        } catch (err) {
          document.body.removeChild(textArea);
          throw err;
        }
      } catch (error) {
        console.error('Copy failed:', error);
        // Show script in alert as last resort
        toast.error('Не удалось скопировать автоматически. Скрипт показан ниже.');
        // Also log to console for easy copy
        console.log('SQL Script:', sqlScript);
      }
    };
    
    copyToClipboard();
  };

  const handleSave = async (item: ContentItem) => {
    setSaving(true);
    try {
      // Use local API server
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(
        getApiUrl('admin/content'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user?.access_token || ''}`,
          },
          body: JSON.stringify({
            id: item.id,
            key: item.key,
            value: editValue,
            category: item.category,
            description: item.description,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        toast.error('Ошибка сохранения: ' + (result.error || 'Неизвестная ошибка'));
        return;
      }

      toast.success('Контент успешно обновлен!');
      setEditingId(null);
      loadContent();
      onContentUpdated();
    } catch (error) {
      console.error('Save content error:', error);
      toast.error('Ошибка подключения к серверу');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (item: ContentItem) => {
    setEditingId(item.id);
    setEditValue(item.value);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(content.map(item => item.category)))];

  // Filter content
  const filteredContent = content.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group by category for display
  const groupedContent: { [key: string]: ContentItem[] } = {};
  filteredContent.forEach(item => {
    if (!groupedContent[item.category]) {
      groupedContent[item.category] = [];
    }
    groupedContent[item.category].push(item);
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center text-gray-500">
            <RefreshCw className="animate-spin mx-auto mb-4" size={32} />
            Загрузка контента...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error screen for unauthorized access
  if (tableError === 'UNAUTHORIZED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={24} />
            Управление контентом
          </CardTitle>
          <CardDescription>
            Требуется авторизация администратора
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertDescription className="ml-2">
              <strong className="text-lg block mb-2">Требуется права администратора!</strong>
              <p className="mb-3">
                Для доступа к управлению контентом необходимо добавить ваш пользователь в список администраторов.
              </p>
              <p className="text-sm mb-3">
                Выполните этот SQL скрипт в Supabase SQL Editor (замените email на ваш):
              </p>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Шаг 1: Узнайте ваш User ID</p>
                <p className="text-xs text-gray-600 mb-2">
                  Выполните в SQL Editor, чтобы найти ваш User ID:
                </p>
                <pre className="bg-yellow-100 p-2 rounded text-xs overflow-x-auto mb-2">
-- Найти ваш User ID по email
SELECT id, email FROM auth.users WHERE email = 'ilnar.nabiev81@gmail.com';</pre>
                
                <p className="text-sm font-semibold mt-3">Шаг 2: Добавьте себя как администратора</p>
                <p className="text-xs text-gray-600 mb-2">
                  Выполните этот SQL (замените YOUR_USER_ID на ID из шага 1):
                </p>
                <pre className="bg-yellow-100 p-2 rounded text-xs overflow-x-auto mb-2">
-- Вариант 1: По User ID (рекомендуется)
INSERT INTO kv_store_90636d20 (key, value)
VALUES ('admin:YOUR_USER_ID', '"true"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '"true"'::jsonb;</pre>
                
                <p className="text-xs text-gray-600 mb-2">
                  Или используйте email (если он точно правильный):
                </p>
                <pre className="bg-yellow-100 p-2 rounded text-xs overflow-x-auto mb-2">
-- Вариант 2: По email
INSERT INTO kv_store_90636d20 (key, value)
SELECT 
  'admin:' || id::text as key,
  '"true"'::jsonb as value
FROM auth.users
WHERE email = 'ilnar.nabiev81@gmail.com'
ON CONFLICT (key) DO UPDATE SET value = '"true"'::jsonb;</pre>
                
                <p className="text-sm font-semibold mt-3">Шаг 3: Проверьте, что запись добавлена</p>
                <pre className="bg-yellow-100 p-2 rounded text-xs overflow-x-auto mb-2">
-- Проверка: должны увидеть запись с key = 'admin:YOUR_USER_ID'
SELECT key, value FROM kv_store_90636d20 WHERE key LIKE 'admin:%';</pre>
                
                <p className="text-sm mt-3">
                  После выполнения всех шагов обновите страницу (Ctrl+F5).
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Show error screen only if table is actually not found
  if (tableError === 'TABLE_NOT_FOUND') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={24} />
            Управление контентом
          </CardTitle>
          <CardDescription>
            Редактируйте тексты на сайте в реальном времени
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertDescription className="ml-2">
              <strong className="text-lg block mb-2">Таблица контента не найдена!</strong>
              <p className="mb-3">
                Для работы системы управления контентом необходимо создать таблицу в Supabase.
              </p>
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                <p className="text-sm text-red-800 font-semibold mb-1">⚠️ Если вы уже создали таблицу:</p>
                <p className="text-xs text-red-700 mb-2">
                  Возможно, нужно обновить кэш схемы. Попробуйте:
                </p>
                <ol className="text-xs text-red-700 list-decimal list-inside space-y-1 ml-2">
                  <li>Выполните SQL скрипт повторно (он безопасен и обновит кэш)</li>
                  <li>Или подождите 1-2 минуты и обновите страницу (Ctrl+F5)</li>
                  <li>Проверьте в Supabase Dashboard → Table Editor, что таблица <code className="bg-red-100 px-1 rounded">content</code> существует</li>
                </ol>
              </div>
              <ol className="list-decimal list-inside space-y-2 mb-3 text-sm">
                <li>Откройте <strong>Supabase Dashboard</strong> → <strong>SQL Editor</strong></li>
                <li>Нажмите кнопку <strong>"Скопировать SQL скрипт"</strong> ниже</li>
                <li>Вставьте скрипт в SQL Editor и нажмите <strong>Run</strong> (или F5)</li>
                <li>Дождитесь сообщения <strong>"Success. No rows returned"</strong></li>
                <li>Подождите 10-30 секунд для обновления кэша схемы</li>
                <li>Нажмите <strong>"Обновить страницу"</strong> здесь</li>
              </ol>
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => copySQLScript()} 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
              type="button"
              disabled={false}
            >
              <Copy size={14} className="mr-2" />
              Скопировать SQL скрипт
            </Button>
            <Button 
              onClick={() => {
                console.log('Reloading content...');
                loadContent();
              }} 
              variant="outline" 
              size="sm"
              type="button"
              disabled={loading}
            >
              <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Загрузка...' : 'Обновить страницу'}
            </Button>
          </div>
          
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <p className="text-xs text-gray-600 mb-2">
              <strong>Диагностика:</strong> Откройте консоль браузера (F12) и проверьте ошибки при нажатии "Обновить страницу".
            </p>
            <p className="text-xs text-gray-600 mb-2">
              <strong>Ошибка PGRST205:</strong> Таблица создана, но PostgREST не видит её в кэше.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
              <p className="text-xs text-yellow-800 font-semibold mb-1">Решение (попробуйте по порядку):</p>
              <ol className="text-xs text-yellow-700 list-decimal list-inside space-y-1">
                <li><strong>Проверьте таблицу:</strong> Supabase Dashboard → Table Editor → должна быть таблица <code className="bg-yellow-100 px-1 rounded">content</code></li>
                <li><strong>Выполните команду обновления кэша:</strong> В SQL Editor выполните:
                  <pre className="bg-yellow-100 p-2 rounded mt-1 text-xs overflow-x-auto">NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');</pre>
                </li>
                <li><strong>Подождите 1-2 минуты</strong> (кэш обновляется не мгновенно)</li>
                <li><strong>Обновите страницу полностью:</strong> Ctrl+F5 (Windows) или Cmd+Shift+R (Mac)</li>
                <li>Если не помогло - <strong>перезапустите проект Supabase</strong> (Settings → General → Restart project)</li>
              </ol>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-xs text-green-800 font-semibold mb-1">✅ Быстрая проверка таблицы:</p>
            <p className="text-xs text-green-700 mb-2">
              Выполните в Supabase SQL Editor, чтобы убедиться, что таблица существует:
            </p>
            <pre className="bg-green-100 p-2 rounded text-xs overflow-x-auto mb-2">
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name = 'content' AND table_schema = 'public';</pre>
            <p className="text-xs text-green-700 mb-2">
              Если видите строку с <code className="bg-green-200 px-1 rounded">content | public</code> - таблица создана правильно.
            </p>
            <p className="text-xs text-green-800 font-semibold mt-3 mb-1">🔧 Если таблица существует, но не видна:</p>
            <p className="text-xs text-green-700 mb-2">
              Выполните этот скрипт для принудительного обновления кэша:
            </p>
            <pre className="bg-green-100 p-2 rounded text-xs overflow-x-auto mb-2">
-- Принудительное обновление кэша PostgREST
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE content TO anon, authenticated;
GRANT ALL ON TABLE content TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');</pre>
            <p className="text-xs text-green-700">
              Затем подождите 30-60 секунд и обновите страницу (Ctrl+F5).
            </p>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-xs text-red-800 font-semibold mb-2">🔍 КРИТИЧЕСКАЯ ПРОВЕРКА (выполните сейчас):</p>
            <p className="text-xs text-red-700 mb-2">
              <strong>1. Проверьте настройки API в Supabase:</strong>
            </p>
            <ol className="text-xs text-red-700 list-decimal list-inside space-y-1 mb-3">
              <li>Откройте <strong>Supabase Dashboard</strong></li>
              <li>Перейдите в <strong>Settings → API</strong></li>
              <li>Найдите раздел <strong>"Exposed schemas"</strong> или <strong>"API Settings"</strong></li>
              <li>Убедитесь, что схема <code className="bg-red-100 px-1 rounded">public</code> включена</li>
              <li>Если её нет - добавьте <code className="bg-red-100 px-1 rounded">public</code> и сохраните</li>
            </ol>
            <p className="text-xs text-red-700 mb-2">
              <strong>2. Выполните диагностический SQL скрипт:</strong>
            </p>
            <pre className="bg-red-100 p-2 rounded text-xs overflow-x-auto mb-2">
-- Проверка таблицы и схемы
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename = 'content';

-- Проверка прав
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'content' AND table_schema = 'public';

-- Проверка RLS политик
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'content' AND schemaname = 'public';</pre>
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <p className="text-xs text-purple-800 font-semibold mb-1">🚀 Радикальное решение (если ничего не помогло):</p>
            <p className="text-xs text-purple-700 mb-2">
              Если таблица существует, но PostgREST все еще не видит её:
            </p>
            <p className="text-xs text-purple-700 mb-2 font-semibold">Попробуйте в таком порядке:</p>
            <ol className="text-xs text-purple-700 list-decimal list-inside space-y-1">
              <li><strong>Добавьте тестовую строку через Table Editor:</strong> Supabase Dashboard → Table Editor → content → Insert row → добавьте любую строку (key: test, value: test, category: test)</li>
              <li><strong>Попробуйте временно отключить RLS (только для теста):</strong></li>
            </ol>
            <pre className="bg-purple-100 p-2 rounded text-xs overflow-x-auto mt-2 mb-2">
ALTER TABLE content DISABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');</pre>
            <p className="text-xs text-purple-700 mb-2">Затем обновите страницу. Если заработает - проблема в RLS политиках.</p>
            <ol className="text-xs text-purple-700 list-decimal list-inside space-y-1" start={3}>
              <li><strong>Если не помогло - перезапустите проект:</strong> Settings → General → Restart project (может занять 2-5 минут)</li>
              <li><strong>Последний вариант - пересоздайте таблицу:</strong> Выполните скрипт ниже (⚠️ ВНИМАНИЕ: удалит все данные!)</li>
            </ol>
            <pre className="bg-red-100 p-2 rounded text-xs overflow-x-auto mt-2 mb-2">
-- ⚠️ ВНИМАНИЕ: Это удалит таблицу и все данные!
DROP TABLE IF EXISTS content CASCADE;

-- Затем выполните полный SQL скрипт создания таблицы заново</pre>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800 font-semibold mb-1">ℹ️ Ошибка "Unauthorized - Admin access required":</p>
            <p className="text-xs text-blue-700 mb-2">
              Эта ошибка означает, что ваш пользователь не добавлен в список администраторов в KV Store.
            </p>
            <p className="text-xs text-blue-700 mb-2">
              <strong>Решение:</strong> Выполните этот SQL скрипт в Supabase SQL Editor (замените email на ваш):
            </p>
            <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto mb-2">
-- Добавление пользователя как администратора
INSERT INTO kv_store_90636d20 (key, value)
SELECT 
  'admin:' || id::text as key,
  '"true"'::jsonb as value
FROM auth.users
WHERE email = 'ilnar.nabiev81@gmail.com'
ON CONFLICT (key) DO UPDATE SET value = '"true"'::jsonb;</pre>
            <p className="text-xs text-blue-700">
              После выполнения скрипта обновите страницу (Ctrl+F5).
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold mb-2 text-sm">Альтернативный способ:</h4>
            <p className="text-xs text-gray-600 mb-2">
              Вы можете найти полный SQL скрипт с начальными данными в файле:
            </p>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs block">
              src/CONTENT_SETUP.md
            </code>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText size={24} />
              Управление контентом
            </CardTitle>
            <CardDescription>
              Редактируйте тексты на сайте. Изменения применяются мгновенно для всех пользователей.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={loadContent} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Search and filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input
                id="content-search"
                name="search"
                type="search"
                autoComplete="off"
                placeholder="Поиск по ключу, значению или описанию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search content by key, value or description"
              />
            </div>
            <div className="flex gap-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === 'all' ? 'Все' : cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Alert about changes */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 ml-2">
              <strong>Обратите внимание:</strong> Изменения вступают в силу сразу после сохранения. 
              Пользователи увидят новые тексты при следующей загрузке страницы.
            </AlertDescription>
          </Alert>

          {/* Empty state */}
          {content.length === 0 && !loading && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 ml-2">
                <strong>Таблица создана успешно!</strong> Но она пока пуста. 
                <br />
                <span className="text-sm mt-1 block">
                  Вы можете добавить контент через SQL Editor или начать редактировать существующие ключи. 
                  Система автоматически использует fallback контент, пока вы не добавите свои значения.
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* Content by category */}
          <div className="space-y-8">
            {Object.keys(groupedContent).length === 0 && content.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>Ничего не найдено по вашему запросу</p>
              </div>
            )}
            {Object.entries(groupedContent).map(([category, items]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg capitalize">{category}</h3>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>

                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded text-blue-600">
                              {item.key}
                            </code>
                            {item.description && (
                              <span className="text-xs text-gray-500">
                                {item.description}
                              </span>
                            )}
                          </div>
                          
                          {editingId === item.id ? (
                            <div className="space-y-2">
                              {item.key === 'header.logoIcon' ? (
                                <div className="space-y-3">
                                  <div className="text-sm font-medium text-gray-700 mb-2">
                                    Выберите тип иконки или введите SVG код:
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 mb-3">
                                    {['link', 'zap', 'globe', 'sparkles', 'award'].map((iconType) => (
                                      <button
                                        key={iconType}
                                        type="button"
                                        onClick={() => setEditValue(iconType)}
                                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                                          editValue === iconType
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                      >
                                        <div className="text-xs font-medium capitalize mb-1">{iconType}</div>
                                      </button>
                                    ))}
                                  </div>
                                  <div className="text-xs text-gray-500 mb-2">
                                    Или введите SVG код напрямую (начните с &lt;svg):
                                  </div>
                                  <Textarea
                                    id={`textarea-${item.id}`}
                                    name={`content-${item.key}`}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-full font-mono text-sm"
                                    rows={6}
                                    placeholder='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">...</svg>'
                                    aria-label={`Edit content for ${item.key}`}
                                  />
                                  {editValue && editValue.trim().startsWith('<svg') && (
                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                      <div className="text-xs text-gray-600 mb-2">Предпросмотр:</div>
                                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-xl flex items-center justify-center">
                                        <div 
                                          className="w-6 h-6 text-white"
                                          dangerouslySetInnerHTML={{ __html: editValue }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : item.value.length > 100 ? (
                                <Textarea
                                  id={`textarea-${item.id}`}
                                  name={`content-${item.key}`}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full"
                                  rows={4}
                                  aria-label={`Edit content for ${item.key}`}
                                />
                              ) : (
                                <Input
                                  id={`input-${item.id}`}
                                  name={`content-${item.key}`}
                                  type="text"
                                  autoComplete="off"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full"
                                  aria-label={`Edit content for ${item.key}`}
                                />
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(item)}
                                  disabled={saving || editValue === item.value}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check size={14} className="mr-1" />
                                  Сохранить
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  disabled={saving}
                                >
                                  <X size={14} className="mr-1" />
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-700">
                              {item.key === 'header.logoIcon' ? (
                                <div className="flex items-center gap-3">
                                  <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-xl">
                                    {item.value && item.value.trim().startsWith('<svg') ? (
                                      <div 
                                        className="w-6 h-6 text-white"
                                        dangerouslySetInnerHTML={{ __html: item.value }}
                                      />
                                    ) : (
                                      <span className="text-white text-xs font-medium capitalize">
                                        {item.value || 'link'}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {item.value && item.value.trim().startsWith('<svg') 
                                      ? 'Кастомный SVG' 
                                      : `Тип: ${item.value || 'link'}`}
                                  </span>
                                </div>
                              ) : (
                                item.value
                              )}
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-400">
                            Обновлено: {new Date(item.updated_at).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        
                        {editingId !== item.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(item)}
                          >
                            <Edit size={14} className="mr-1" />
                            Редактировать
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredContent.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Search className="mx-auto mb-4 text-gray-400" size={48} />
              <p>Ничего не найдено</p>
              <p className="text-sm">Попробуйте изменить поисковый запрос или фильтр</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
