# Настройка системы управления контентом

## 1. Создание таблицы в Supabase

Выполните следующий SQL в вашей Supabase SQL Editor:

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

-- Индекс для быстрого поиска по категориям
CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
CREATE INDEX IF NOT EXISTS idx_content_key ON content(key);

-- RLS политики
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Все могут читать контент
CREATE POLICY "Контент доступен для чтения всем"
  ON content FOR SELECT
  USING (true);

-- Только администраторы могут редактировать
-- Замените 'admin@yourdomain.com' на email вашего админа
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

## 2. Добавление начальных данных

После создания таблицы, выполните следующий SQL для добавления текстов:

```sql
-- Главная страница - Hero секция
INSERT INTO content (key, value, category, description) VALUES
('home.hero.badge', 'Современный сервис сокращения ссылок', 'home', 'Значок над заголовком hero секции'),
('home.hero.title', 'Превратите длинные ссылки в мощный инструмент маркетинга', 'home', 'Главный заголовок hero секции'),
('home.hero.subtitle', 'Создавайте короткие ссылки, отслеживайте каждый клик и принимайте решения на основе данных', 'home', 'Подзаголовок hero секции'),
('home.hero.card.title', 'Создайте короткую ссылку прямо сейчас', 'home', 'Заголовок карточки создания ссылки'),
('home.hero.card.description.auth', '✨ Неограниченное количество ссылок с расширенной аналитикой', 'home', 'Описание для авторизованных'),
('home.hero.card.description.guest', '🚀 5 бесплатных ссылок без регистрации', 'home', 'Описание для гостей'),
('home.hero.url.placeholder', 'https://example.com/очень/длинная/ссылка/которую/нужно/сократить', 'home', 'Placeholder для URL'),
('home.hero.domain.placeholder', 'Кастомный домен (опционально): link.mysite.com', 'home', 'Placeholder для домена'),
('home.hero.button', 'Сократить ссылку', 'home', 'Текст кнопки сокращения'),
('home.hero.button.loading', 'Создание...', 'home', 'Текст кнопки во время загрузки'),
('home.hero.success', 'Ссылка успешно создана!', 'home', 'Сообщение об успешном создании'),

-- Главная - Почему выбирают нас
('home.why.title', 'Почему выбирают наш сервис?', 'home', 'Заголовок секции преимуществ'),
('home.why.subtitle', 'Мы предлагаем больше, чем просто сокращение ссылок', 'home', 'Подзаголовок секции преимуществ'),
('home.why.analytics.title', 'Детальная аналитика', 'home', 'Заголовок карточки аналитики'),
('home.why.analytics.description', 'Отслеживайте каждый клик с информацией о геолокации, устройствах, браузерах и источниках трафика', 'home', 'Описание аналитики'),
('home.why.domains.title', 'Кастомные домены', 'home', 'Заголовок карточки доменов'),
('home.why.domains.description', 'Используйте собственный домен для укрепления доверия и узнаваемости бренда', 'home', 'Описание доменов'),
('home.why.security.title', 'Безопасность', 'home', 'Заголовок карточки безопасности'),
('home.why.security.description', 'Ваши данные защищены современными технологиями шифрования и безопасного хранения', 'home', 'Описание безопасности'),

-- Главная - Преимущества для бизнеса
('home.benefits.title', 'Преимущества для вашего бизнеса', 'home', 'Заголовок секции преимуществ бизнеса'),
('home.benefits.subtitle', 'Увеличьте конверсию и оптимизируйте маркетинговые кампании', 'home', 'Подзаголовок секции преимуществ бизнеса'),
('home.benefits.ctr.title', 'Увеличьте CTR на 30%', 'home', 'Заголовок преимущества CTR'),
('home.benefits.ctr.description', 'Короткие ссылки выглядят профессионально и вызывают больше доверия у пользователей, что приводит к росту кликабельности', 'home', 'Описание преимущества CTR'),
('home.benefits.audience.title', 'Понимайте свою аудиторию', 'home', 'Заголовок преимущества аудитории'),
('home.benefits.audience.description', 'Получайте детальную информацию о каждом посетителе: откуда пришел, какое устройство использует и в какой стране находится', 'home', 'Описание преимущества аудитории'),
('home.benefits.instant.title', 'Мгновенное создание', 'home', 'Заголовок преимущества мгновенного создания'),
('home.benefits.instant.description', 'Создавайте короткие ссылки за секунды без регистрации. Для продвинутых функций зарегистрируйтесь бесплатно', 'home', 'Описание преимущества мгновенного создания'),
('home.benefits.brand.title', 'Укрепите бренд', 'home', 'Заголовок преимущества бренда'),
('home.benefits.brand.description', 'Используйте кастомные домены для создания узнаваемых ссылок, которые соответствуют вашему бренду', 'home', 'Описание преимущества бренда'),

-- Главная - Случаи использования
('home.usecases.title', 'Идеально для любых задач', 'home', 'Заголовок секции случаев использования'),
('home.usecases.subtitle', 'От личных проектов до корпоративных решений', 'home', 'Подзаголовок секции случаев использования'),
('home.usecases.social.title', 'Социальные сети', 'home', 'Заголовок случая использования - соцсети'),
('home.usecases.social.description', 'Оптимизируйте посты в Instagram, Twitter, Facebook и других соцсетях', 'home', 'Описание случая использования - соцсети'),
('home.usecases.email.title', 'Email маркетинг', 'home', 'Заголовок случая использования - email'),
('home.usecases.email.description', 'Отслеживайте эффективность email кампаний с точной аналитикой', 'home', 'Описание случая использования - email'),
('home.usecases.content.title', 'Контент маркетинг', 'home', 'Заголовок случая использования - контент'),
('home.usecases.content.description', 'Делитесь контентом с красивыми короткими ссылками и следите за вовлеченностью', 'home', 'Описание случая использования - контент'),

-- Главная - CTA
('home.cta.title', 'Готовы начать?', 'home', 'Заголовок CTA секции'),
('home.cta.subtitle', 'Зарегистрируйтесь бесплатно и получите доступ ко всем возможностям платформы', 'home', 'Подзаголовок CTA секции'),
('home.cta.button.primary', 'Начать бесплатно', 'home', 'Текст основной кнопки CTA'),
('home.cta.button.secondary', 'Смотреть демо', 'home', 'Текст дополнительной кнопки CTA'),
('home.cta.note', 'Кредитная карта не требуется • Настройка за 2 минуты • Отмена в любое время', 'home', 'Примечание под кнопками CTA'),

-- Главная - Статистика
('home.stats.links', '1M+', 'home', 'Количество созданных ссылок'),
('home.stats.links.label', 'Созданных ссылок', 'home', 'Подпись для статистики ссылок'),
('home.stats.users', '50K+', 'home', 'Количество пользователей'),
('home.stats.users.label', 'Активных пользователей', 'home', 'Подпись для статистики пользователей'),
('home.stats.clicks', '10M+', 'home', 'Количество кликов'),
('home.stats.clicks.label', 'Отслеженных кликов', 'home', 'Подпись для статистики кликов'),
('home.stats.uptime', '99.9%', 'home', 'Время работы'),
('home.stats.uptime.label', 'Время работы', 'home', 'Подпись для времени работы'),

-- Хедер
('header.logo', 'ShortURL', 'header', 'Название сервиса в логотипе'),
('header.login', 'Войти / Регистрация', 'header', 'Текст кнопки входа'),
('header.logout', 'Выйти', 'header', 'Текст кнопки выхода'),

-- Авторизация
('auth.title', 'Присоединяйтесь к ShortURL', 'auth', 'Заголовок модального окна авторизации'),
('auth.subtitle', 'Получите доступ ко всем возможностям платформы', 'auth', 'Подзаголовок модального окна'),
('auth.benefits.title', 'Преимущества аккаунта', 'auth', 'Заголовок списка преимуществ'),
('auth.benefits.links', 'Неограниченное количество ссылок', 'auth', 'Преимущество - ссылки'),
('auth.benefits.analytics', 'Детальная аналитика и статистика', 'auth', 'Преимущество - аналитика'),
('auth.benefits.domains', 'Кастомные домены', 'auth', 'Преимущество - домены'),
('auth.benefits.geo', 'Геолокация посетителей', 'auth', 'Преимущество - геолокация'),
('auth.benefits.history', 'История всех переходов', 'auth', 'Преимущество - история'),
('auth.benefits.support', 'Приоритетная поддержка', 'auth', 'Преимущество - поддержка'),
('auth.free.title', '100% Бесплатно', 'auth', 'Заголовок блока о бесплатности'),
('auth.free.description', 'Никаких скрытых платежей. Все функции доступны бесплатно навсегда.', 'auth', 'Описание бесплатности'),
('auth.login.tab', 'Вход', 'auth', 'Название вкладки входа'),
('auth.signup.tab', 'Регистрация', 'auth', 'Название вкладки регистрации'),
('auth.email.label', 'Email', 'auth', 'Подпись поля email'),
('auth.password.label', 'Пароль', 'auth', 'Подпись поля пароля'),
('auth.name.label', 'Имя', 'auth', 'Подпись поля имени'),
('auth.login.button', 'Войти', 'auth', 'Текст кнопки входа'),
('auth.signup.button', 'Зарегистрироваться бесплатно', 'auth', 'Текст кнопки регистрации'),
('auth.social.divider', 'Или войти через', 'auth', 'Разделитель для соц.сетей'),

-- Dashboard
('dashboard.title', 'Личный кабинет', 'dashboard', 'Заголовок дашборда'),
('dashboard.subtitle', 'Управляйте своими ссылками и отс��еживайте статистику', 'dashboard', 'Подзаголовок дашборда'),
('dashboard.settings', 'Настройки доменов', 'dashboard', 'Кнопка настроек'),
('dashboard.stats.links', 'Всего ссылок', 'dashboard', 'Заголовок статистики ссылок'),
('dashboard.stats.links.note', 'Без ограничений', 'dashboard', 'Примечание для статистики ссылок'),
('dashboard.stats.clicks', 'Всего переходов', 'dashboard', 'Заголовок статистики переходов'),
('dashboard.stats.clicks.note', 'За все время', 'dashboard', 'Примечание для статистики переходов'),
('dashboard.stats.ctr', 'Средний CTR', 'dashboard', 'Заголовок статистики CTR'),
('dashboard.stats.ctr.note', 'Кликов на ссылку', 'dashboard', 'Примечание для статистики CTR'),
('dashboard.links.title', 'Мои ссылки', 'dashboard', 'Заголовок списка ссылок'),
('dashboard.links.create', 'Создать ссылку', 'dashboard', 'Кнопка создания ссылки'),
('dashboard.links.empty', 'У вас пока нет сокращенных ссылок', 'dashboard', 'Сообщение при отсутствии ссылок'),
('dashboard.links.create.first', 'Создать первую ссылку', 'dashboard', 'Кнопка создания первой ссылки'),

-- Админ панель
('admin.title', 'Административная панель', 'admin', 'Заголовок админ панели'),
('admin.subtitle', 'Управление всеми ссылками в системе', 'admin', 'Подзаголовок админ панели'),
('admin.total', 'Всего ссылок:', 'admin', 'Текст общего количества ссылок'),
('admin.refresh', 'Обновить', 'admin', 'Кнопка обновления'),
('admin.content.title', 'Управление контентом', 'admin', 'Заголовок управления контентом'),
('admin.content.subtitle', 'Редактируйте тексты на сайте', 'admin', 'Подзаголовок управления контентом')

ON CONFLICT (key) DO NOTHING;
```

## 3. Настройка прав администратора

Замените `'admin@yourdomain.com'` в SQL-запросе политики RLS на email вашего администратора.

## 4. Использование

После выполнения SQL-скриптов, все тексты будут загружаться из базы данных и их можно будет редактировать через админ-панель без пересборки приложения.
