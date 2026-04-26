# Инструкция по внедрению отслеживания источника трафика

## Шаг 1: Применить миграцию базы данных

Выполните SQL-миграцию для добавления полей в таблицу `urls`:

```bash
psql -U urlshortener -d urlshortener -f server/migrations/add_traffic_source_tracking.sql
```

Или выполните SQL напрямую в вашей базе данных:

```sql
-- Скопируйте содержимое файла add_traffic_source_tracking.sql
-- и выполните в вашей базе данных
```

## Шаг 2: Перезапустить сервер

После применения миграции перезапустите сервер:

```bash
# Если используете systemd
sudo systemctl restart url-shortener

# Или если используете PM2
pm2 restart url-shortener
```

## Шаг 3: Проверить работу

1. Откройте сайт с UTM-параметрами:
   ```
   https://cutto.tech/?utm_source=google&utm_medium=cpc&utm_campaign=nigeria_pakistan&gclid=test123
   ```

2. Создайте короткую ссылку

3. Проверьте в базе данных, что данные сохранились:
   ```sql
   SELECT short_code, utm_source, utm_medium, utm_campaign, gclid 
   FROM urls 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## Как это работает

1. **При загрузке страницы**: Фронтенд автоматически извлекает UTM-параметры из URL и сохраняет их в `sessionStorage`
2. **При создании ссылки**: Данные о трафике отправляются на бэкенд вместе с URL
3. **В базе данных**: Все данные сохраняются в таблице `urls` в соответствующих полях

## Обратная совместимость

- Если пользователь пришел без UTM-параметров, все поля будут `NULL`
- Старые ссылки продолжат работать без изменений
- Система работает как раньше, просто добавляется дополнительная информация

## Аналитика

Используйте SQL-запросы из файла `traffic_source_analytics_queries.sql` для анализа эффективности кампаний.

Основной запрос для связи кампаний и WAP-показов:

```sql
SELECT 
  COALESCE(u.utm_campaign, 'Organic / Direct') AS "Рекламная кампания",
  COUNT(DISTINCT u.id) AS "Создано ссылок",
  COUNT(DISTINCT s.id) AS "Всего кликов",
  COUNT(DISTINCT CASE WHEN od.showed_offer = true THEN od.id END) AS "WAP-показов"
FROM urls u
LEFT JOIN stats s ON s.url_id = u.id
LEFT JOIN offer_decisions od ON od.url_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.utm_campaign
ORDER BY "WAP-показов" DESC;
```

