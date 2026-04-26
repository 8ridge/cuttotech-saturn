-- ============================================================================
-- SQL QUERIES FOR TRAFFIC SOURCE ANALYTICS
-- ============================================================================
-- Эти запросы позволяют анализировать эффективность рекламных кампаний
-- и связывать их с WAP-показами из таблицы offer_decisions
-- ============================================================================

-- ============================================================================
-- 1. ОСНОВНОЙ ЗАПРОС: Связь между кампаниями и WAP-показами
-- ============================================================================
-- Показывает: из какой кампании создано ссылок, сколько кликов и WAP-показов
-- ============================================================================

SELECT 
  COALESCE(u.utm_campaign, 'Organic / Direct') AS "Рекламная кампания",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Всего кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов",
  ROUND(
    COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END)::numeric / 
    NULLIF(COUNT(DISTINCT s.id), 0) * 100, 
    2
  ) AS "Процент WAP-показов (%)",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.country_code END) AS "Стран с WAP-показами"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'  -- Последние 30 дней
GROUP BY u.utm_campaign
ORDER BY "WAP-показов" DESC, "Создано ссылок" DESC;

-- ============================================================================
-- 2. ДЕТАЛЬНАЯ СТАТИСТИКА ПО КАМПАНИИ
-- ============================================================================
-- Замените 'nigeria_pakistan' на название вашей кампании
-- ============================================================================

SELECT 
  u.short_code AS "Короткая ссылка",
  u.original_url AS "Оригинальный URL",
  u.utm_source AS "Источник",
  u.utm_medium AS "Канал",
  u.utm_campaign AS "Кампания",
  u.utm_content AS "Контент",
  u.created_at AS "Дата создания",
  COUNT(DISTINCT s.id) AS "Кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.country_code END) AS "Стран"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.utm_campaign = 'nigeria_pakistan'  -- Замените на вашу кампанию
GROUP BY u.id, u.short_code, u.original_url, u.utm_source, u.utm_medium, 
         u.utm_campaign, u.utm_content, u.created_at
ORDER BY u.created_at DESC;

-- ============================================================================
-- 3. СТАТИСТИКА ПО ИСТОЧНИКАМ ТРАФИКА (utm_source)
-- ============================================================================

SELECT 
  COALESCE(u.utm_source, 'Direct / Organic') AS "Источник трафика",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Всего кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов",
  ROUND(
    COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END)::numeric / 
    NULLIF(COUNT(DISTINCT s.id), 0) * 100, 
    2
  ) AS "Процент WAP-показов (%)"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.utm_source
ORDER BY "WAP-показов" DESC;

-- ============================================================================
-- 4. СТАТИСТИКА ПО КАНАЛАМ (utm_medium)
-- ============================================================================

SELECT 
  COALESCE(u.utm_medium, 'Direct / Organic') AS "Канал",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Всего кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.utm_medium
ORDER BY "WAP-показов" DESC;

-- ============================================================================
-- 5. СТАТИСТИКА ПО КАМПАНИЯМ С РАЗБИВКОЙ ПО СТРАНАМ
-- ============================================================================

SELECT 
  COALESCE(u.utm_campaign, 'Organic / Direct') AS "Кампания",
  od.country_code AS "Страна",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов"
FROM urls u
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
  AND od.country_code IS NOT NULL
GROUP BY u.utm_campaign, od.country_code
ORDER BY "Кампания", "WAP-показов" DESC;

-- ============================================================================
-- 6. РАСЧЕТ СТОИМОСТИ ОДНОГО WAP-ПОКАЗА (если знаете стоимость кампании)
-- ============================================================================
-- Пример: если кампания "nigeria_pakistan" стоила $100 и дала 50 WAP-показов,
-- то стоимость одного показа = $100 / 50 = $2
-- ============================================================================

-- Сначала получите количество WAP-показов для кампании:
SELECT 
  u.utm_campaign AS "Кампания",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов"
FROM urls u
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.utm_campaign = 'nigeria_pakistan'  -- Замените на вашу кампанию
  AND u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.utm_campaign;

-- Затем разделите стоимость кампании на количество WAP-показов

-- ============================================================================
-- 7. СТАТИСТИКА ПО ДАТАМ (дневная разбивка)
-- ============================================================================

SELECT 
  DATE(u.created_at) AS "Дата",
  COALESCE(u.utm_campaign, 'Organic / Direct') AS "Кампания",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(u.created_at), u.utm_campaign
ORDER BY "Дата" DESC, "WAP-показов" DESC;

-- ============================================================================
-- 8. ТОП-10 САМЫХ ЭФФЕКТИВНЫХ КАМПАНИЙ (по количеству WAP-показов)
-- ============================================================================

SELECT 
  COALESCE(u.utm_campaign, 'Organic / Direct') AS "Кампания",
  u.utm_source AS "Источник",
  u.utm_medium AS "Канал",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Всего кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов",
  ROUND(
    COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END)::numeric / 
    NULLIF(COUNT(DISTINCT s.id), 0) * 100, 
    2
  ) AS "Процент WAP-показов (%)"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.utm_campaign, u.utm_source, u.utm_medium
HAVING COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) > 0
ORDER BY "WAP-показов" DESC
LIMIT 10;

-- ============================================================================
-- 9. СТАТИСТИКА ПО GOOGLE ADS (gclid)
-- ============================================================================

SELECT 
  CASE 
    WHEN u.gclid IS NOT NULL THEN 'Google Ads'
    ELSE 'Other / Organic'
  END AS "Источник",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Всего кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY CASE WHEN u.gclid IS NOT NULL THEN 'Google Ads' ELSE 'Other / Organic' END
ORDER BY "WAP-показов" DESC;

-- ============================================================================
-- 10. ПРИМЕР: Анализ конкретной кампании "Nigeria/Pakistan"
-- ============================================================================

SELECT 
  'Nigeria/Pakistan Campaign' AS "Отчет",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Всего кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов",
  ROUND(
    COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END)::numeric / 
    NULLIF(COUNT(DISTINCT s.id), 0) * 100, 
    2
  ) AS "Процент WAP-показов (%)",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.country_code END) AS "Стран с WAP-показами",
  STRING_AGG(DISTINCT od.country_code, ', ' ORDER BY od.country_code) AS "Список стран"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.utm_campaign = 'nigeria_pakistan'
  AND u.created_at >= NOW() - INTERVAL '30 days';

