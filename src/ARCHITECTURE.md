# Архитектура URL Shortener

## Обзор системы

URL Shortener - это полнофункциональный веб-сервис, построенный на современной трехуровневой архитектуре с использованием serverless подхода.

## Архитектурные принципы

### 1. **Separation of Concerns** (Разделение ответственности)
- Frontend отвечает только за UI/UX
- Backend обрабатывает бизнес-логику
- Database управляет персистентностью данных

### 2. **Stateless Architecture** (Безсостояние)
- Каждый HTTP запрос независим
- Состояние хранится в JWT токенах (Supabase Auth)
- Scalable и fault-tolerant

### 3. **API-First Design**
- RESTful API endpoints
- Четкие контракты между frontend и backend
- Возможность создания mobile приложений

### 4. **Security by Design**
- Аутентификация на каждом уровне
- HTTPS обязателен
- Rate limiting и CORS защита

## Диаграмма архитектуры

```
┌───────────────────────────────────────────────────────────────┐
│                         User Browser                          │
│                    (React SPA + TypeScript)                   │
└────────────────┬──────────────────────────────────────────────┘
                 │
                 │ HTTPS/443
                 ▼
┌──────────────────────────────────────────────────────────────┐
│                      Nginx Reverse Proxy                      │
│   • SSL Termination (Let's Encrypt)                          │
│   • Static File Serving (/dist)                              │
│   • Rate Limiting                                             │
│   • Compression (gzip)                                        │
│   • Security Headers                                          │
└────────────┬─────────────────────────────────────────────────┘
             │
             │ Forward API requests
             ▼
┌──────────────────────────────────────────────────────────────┐
│              Supabase Edge Functions (Deno Runtime)           │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Hono Web Framework (TypeScript)            │     │
│  │                                                     │     │
│  │  Routes:                                            │     │
│  │  • POST /shorten       - Create short URL          │     │
│  │  • GET  /redirect/:id  - Get original URL          │     │
│  │  • GET  /stats/:id     - Get statistics            │     │
│  │  • GET  /user/urls     - User's URLs               │     │
│  │  • DELETE /url/:id     - Delete URL                │     │
│  │  • POST /signup        - User registration         │     │
│  │  • GET  /admin/urls    - Admin panel (all URLs)    │     │
│  │  • POST /domain/custom - Set custom domain         │     │
│  │                                                     │     │
│  │  Middleware:                                        │     │
│  │  • CORS                                             │     │
│  │  • Logger                                           │     │
│  │  • Auth (JWT verification)                         │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  External API Integrations:                                  │
│  • ipapi.co - Geolocation by IP                             │
└────────────┬─────────────────────────────────────────────────┘
             │
             │ Supabase Client
             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Supabase Services                          │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │  Auth Service   │  │   PostgreSQL    │  │   Storage    ││
│  │                 │  │                 │  │              ││
│  │  • JWT Tokens   │  │  KV Store Table │  │  (optional)  ││
│  │  • OAuth (G/FB) │  │  • urls         │  │  for files   ││
│  │  • Email        │  │  • stats        │  │              ││
│  │  • Sessions     │  │  • users        │  │              ││
│  └─────────────────┘  └─────────────────┘  └──────────────┘│
└──────────────────────────────────────────────────────────────┘
```

## Компоненты системы

### Frontend Layer

#### Технологии
- **React 18** - Component-based UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Vite** - Build tool & dev server

#### Структура компонентов

```
/components
├── /ui               # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── Header.tsx        # Navigation & auth status
├── AuthModal.tsx     # Login/Register modal
├── HomePage.tsx      # Main page with shortening form
├── Dashboard.tsx     # User's URLs list
├── StatsView.tsx     # Detailed statistics
├── AdminPanel.tsx    # Admin interface
└── SettingsPage.tsx  # Custom domains settings
```

#### State Management
- **React Hooks** (useState, useEffect)
- **Local State** - component level
- **Supabase Auth State** - global auth context
- **URL State** - for routing and navigation

#### Routing Strategy
- **SPA routing** - handled by browser history API
- **Nginx fallback** - все routes → index.html
- **Short URL detection** - в App.tsx при mount

### Backend Layer (Edge Functions)

#### Технологии
- **Deno** - Secure runtime for TypeScript/JavaScript
- **Hono** - Fast, lightweight web framework
- **Supabase Client** - Database & auth SDK

#### API Design

**REST принципы:**
- Stateless requests
- Standard HTTP methods (GET, POST, DELETE)
- JSON request/response
- HTTP status codes

**Authentication Flow:**
```
1. User logs in via Supabase Auth
2. Frontend receives JWT access_token
3. All API requests include: Authorization: Bearer {access_token}
4. Backend verifies token via supabase.auth.getUser()
5. Access granted/denied based on token validity
```

**Authorization Levels:**
1. **Anonymous** - limited to 5 URL shortenings
2. **Authenticated** - unlimited URLs, view own stats
3. **Admin** - access to all URLs and admin panel

#### Short Code Generation

```typescript
Algorithm: Base62 Encoding

Characters: 0-9 a-z A-Z (62 symbols)
Input: timestamp + random number
Output: 7-character short code

Example:
Input: 1704067200123
Process: Convert to base62
Output: "aB3xY9k"

Collision handling:
- Check KV store for existence
- Retry with new random if exists
- Max 10 attempts
```

### Database Layer (Supabase KV Store)

#### Schema Design

**Key-Value Structure:**

```
Table: kv_store_90636d20
Columns: key (text, primary), value (text)

Keys Pattern:

1. URL Data:
   Key:   url:{shortCode}
   Value: {
     originalUrl: string,
     userId: string | null,
     createdAt: ISO8601,
     customDomain: string | null
   }

2. Statistics:
   Key:   stats:{shortCode}:{timestamp}
   Value: {
     ip: string,
     country: string,
     city: string,
     userAgent: string,
     timestamp: ISO8601
   }

3. User URLs:
   Key:   user:{userId}:urls
   Value: [shortCode1, shortCode2, ...]

4. Anonymous Counter:
   Key:   anon:{fingerprint}:count
   Value: number (as string)

5. Admin Flags:
   Key:   admin:{userId}
   Value: "true" | "false"
```

#### Query Patterns

**Get URL by short code:**
```typescript
const data = await kv.get(`url:${shortCode}`);
```

**Get stats for URL:**
```typescript
const stats = await kv.getByPrefix(`stats:${shortCode}:`);
```

**Get user's URLs:**
```typescript
const urls = await kv.get(`user:${userId}:urls`);
```

#### Advantages of KV Store
✅ Simple key-value API
✅ Fast reads (indexed by key)
✅ No schema migrations needed
✅ Good for MVP/prototyping

#### Limitations
⚠️ No complex queries (JOIN, WHERE with multiple conditions)
⚠️ No full-text search
⚠️ Manual indexing needed
⚠️ getByPrefix can be slow for large datasets

**Recommendation for Production:**
Migrate to full PostgreSQL tables with proper indexes for better performance and query capabilities.

## Data Flow

### 1. URL Shortening Flow

```
User enters URL
    ↓
Frontend validates format
    ↓
POST /shorten with {url, fingerprint}
    ↓
Backend checks anonymous limit (if not authenticated)
    ↓
Generate unique short code (base62)
    ↓
Check for collision in KV store
    ↓
Store: url:{shortCode} → {originalUrl, userId, createdAt}
    ↓
Add to user's list: user:{userId}:urls
    ↓
Return {shortCode, shortUrl}
    ↓
Frontend displays short URL with copy button
```

### 2. Redirect Flow

```
User visits: https://site.com/abc123
    ↓
App detects short code in URL path
    ↓
GET /redirect/abc123
    ↓
Backend retrieves: url:abc123
    ↓
Get visitor IP from headers (x-forwarded-for)
    ↓
Fetch geolocation from ipapi.co
    ↓
Store statistics: stats:abc123:{timestamp}
    ↓
Return original URL
    ↓
Browser redirects to original URL
```

### 3. Statistics Flow

```
User clicks "Statistics" button
    ↓
GET /stats/{shortCode} with auth token
    ↓
Backend verifies ownership (userId matches)
    ↓
Retrieve url:{shortCode}
    ↓
Retrieve all stats:shortCode:*
    ↓
Aggregate data:
  - Total clicks
  - Country distribution
  - Recent clicks
    ↓
Return statistics JSON
    ↓
Frontend displays charts and tables
```

## Security Architecture

### Authentication Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. Login with email/password or OAuth
     ▼
┌─────────────────┐
│ Supabase Auth   │
│                 │
│ • Verify creds  │
│ • Create session│
│ • Issue JWT     │
└────┬────────────┘
     │
     │ 2. Return access_token & refresh_token
     ▼
┌─────────────────┐
│    Frontend     │
│                 │
│ Store tokens in │
│ Supabase client │
└────┬────────────┘
     │
     │ 3. API request with Authorization: Bearer {token}
     ▼
┌─────────────────┐
│  Edge Function  │
│                 │
│ • Extract token │
│ • Verify via    │
│   supabase.auth │
│   .getUser()    │
│ • Authorize     │
│   action        │
└─────────────────┘
```

### Security Layers

**Layer 1: Network**
- HTTPS only (redirect HTTP → HTTPS)
- Nginx SSL termination
- TLS 1.2+ only
- Modern cipher suites

**Layer 2: Application**
- CORS configured (specific origins)
- Rate limiting (Nginx)
- Input validation
- XSS prevention (React escaping)
- CSRF tokens (Supabase handles)

**Layer 3: Authentication**
- JWT with expiration
- Refresh token rotation
- OAuth 2.0 for social login
- Password hashing (Supabase bcrypt)

**Layer 4: Authorization**
- Route-level checks
- Resource ownership verification
- Admin role checks

**Layer 5: Database**
- Service role key never exposed to frontend
- Row Level Security (RLS) можно добавить
- Prepared statements (no SQL injection)

## Performance Optimizations

### Frontend
1. **Code Splitting** - Lazy loading components
2. **Asset Optimization** - Minified JS/CSS
3. **Caching** - Static assets cached (1 year)
4. **Compression** - Gzip/Brotli via Nginx

### Backend
1. **Serverless** - Auto-scaling Edge Functions
2. **Connection Pooling** - Supabase handles DB connections
3. **Response Caching** - Can add Redis for hot data
4. **Efficient Queries** - Direct KV lookups (O(1))

### Database
1. **Indexed Keys** - KV store uses primary key index
2. **Denormalization** - Stats stored separately for fast aggregation
3. **Batch Operations** - mget/mset for multiple keys

### Network
1. **CDN** - Cloudflare для static assets
2. **Edge Computing** - Supabase Edge близко к пользователям
3. **HTTP/2** - Nginx supports HTTP/2
4. **Keep-Alive** - Persistent connections

## Scalability Considerations

### Horizontal Scaling

**Current Setup:**
- ✅ Edge Functions auto-scale
- ✅ Supabase DB can handle thousands of requests/sec
- ✅ Stateless architecture allows multiple instances

**Future Improvements:**
- Load balancer перед Nginx
- Multiple Nginx instances
- Read replicas для database
- Caching layer (Redis/Memcached)

### Vertical Scaling

**Current:**
- KV Store достаточно для миллионов URLs
- Edge Functions имеют разумные лимиты

**Limits:**
- Supabase free tier: 500MB DB, 2GB bandwidth
- Supabase Pro: unlimited (с fair use policy)

### Database Scaling Strategy

**Phase 1 (Current):** KV Store
- Good for: <1M URLs, <100 req/s
- Простая разработка

**Phase 2 (Growth):** Hybrid
- Hot data в KV
- Historical stats в tables
- Aggregated stats в отдельной таблице

**Phase 3 (Scale):** Full Tables
- Properly indexed tables
- Partitioning по времени
- Archiving старых данных

## Monitoring & Observability

### Metrics to Track

**Application Metrics:**
- Request rate (req/s)
- Error rate (%)
- Response time (p50, p95, p99)
- Active users

**Business Metrics:**
- URLs created per day
- Total redirects
- Conversion rate (anonymous → registered)
- Top countries

**Infrastructure Metrics:**
- CPU usage
- Memory usage
- Disk I/O
- Network throughput

### Logging Strategy

**Frontend:**
- Console errors в production
- User actions (optional analytics)
- Performance metrics (web vitals)

**Backend:**
- All requests via Hono logger
- Error logs with stack traces
- Slow query logs
- Auth failures

**Tools:**
- Supabase built-in logs
- Nginx access/error logs
- Sentry для error tracking
- Google Analytics для user behavior

## Disaster Recovery

### Backup Strategy

**Automated:**
- Supabase daily backups (7 days retention)
- Point-in-time recovery (paid plans)

**Manual:**
- Weekly export KV data
- Git для code versioning
- Config files в version control

### Recovery Plan

**Scenario 1: Code Bug**
1. Revert to previous Git commit
2. Redeploy Edge Functions
3. Rollback frontend build

**Scenario 2: Data Loss**
1. Restore from Supabase backup
2. Verify data integrity
3. Check recent transactions

**Scenario 3: Service Outage**
1. Check Supabase status
2. Fallback to cached data (if implemented)
3. Display maintenance page

### High Availability

**Current Setup:**
- Supabase: 99.9% uptime SLA
- Edge Functions: distributed globally
- Nginx: single point of failure ⚠️

**Improvements:**
- Load balancer с health checks
- Multiple Nginx instances
- Failover DNS
- Status page для users

## Future Enhancements

### Short Term (1-3 months)
- [ ] QR code generation для URLs
- [ ] Link expiration dates
- [ ] Password-protected links
- [ ] Custom slug (vanity URLs)
- [ ] Browser extension

### Medium Term (3-6 months)
- [ ] API rate limiting per user
- [ ] Webhooks на redirect events
- [ ] A/B testing для multiple destinations
- [ ] Link preview (og:image support)
- [ ] Analytics dashboard (charts)

### Long Term (6-12 months)
- [ ] Mobile apps (iOS/Android)
- [ ] White-label solution
- [ ] Enterprise features (SSO, teams)
- [ ] Advanced analytics (funnels, cohorts)
- [ ] Machine learning для fraud detection

## Best Practices

### Code Quality
✅ TypeScript для type safety
✅ ESLint для code style
✅ Prettier для formatting
✅ Git hooks (pre-commit checks)

### Testing
⚠️ Unit tests (to be added)
⚠️ Integration tests (to be added)
⚠️ E2E tests (to be added)

### Documentation
✅ README с quick start
✅ DEPLOYMENT guide
✅ ARCHITECTURE overview
✅ API documentation (можно добавить OpenAPI)

### DevOps
✅ CI/CD (GitHub Actions возможен)
✅ Environment separation (dev/staging/prod)
✅ Infrastructure as Code (Terraform возможен)
✅ Monitoring и alerting

## Conclusion

URL Shortener построен на современных, масштабируемых технологиях с фокусом на:
- **Простоту** - минимум dependencies
- **Безопасность** - multiple layers of protection
- **Производительность** - serverless и edge computing
- **Масштабируемость** - горизонтальное scaling by design

Архитектура позволяет легко добавлять новые features и масштабироваться при росте нагрузки.
