# CutToTech

Smart URL shortener with click analytics, geolocation tracking, and custom domains.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind v4
- **Backend:** Node.js (Express) + PostgreSQL
- **Auth:** JWT (email/password) + Google OAuth

## Local development

```bash
# 1. Install
npm install

# 2. Setup PostgreSQL locally and create the database
psql -U postgres -c "CREATE DATABASE cuttotech;"
psql -U postgres -d cuttotech -f server/schema.sql
psql -U postgres -d cuttotech -f server/schema_auth.sql

# 3. Configure env
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# 4. Run dev (two terminals)
npm run dev:server   # API on port 3000
npm run dev          # Vite dev on port 3001 (proxies to :3000)
```

## Production build

```bash
npm run build  # builds frontend → dist/
npm start      # serves API + dist/ on PORT (default 3000)
```

## Deployment (Saturn / Railway / any PaaS)

1. Push to a Git repo
2. Connect the repo on Saturn/Railway
3. Attach a PostgreSQL service (Saturn provides it; auto-injects `DATABASE_URL`)
4. Set environment variables (see `.env.example`):
   - `JWT_SECRET` — generate with `openssl rand -base64 32`
   - `BASE_URL` / `FRONTEND_URL` — your deployed URL
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional, for OAuth)
   - `RESEND_API_KEY` (optional, for emails)
5. Deploy. The platform will:
   - Run `npm install`
   - Run `npm run build` (build hook)
   - Run `npm start` (web process — see `Procfile`)

The Express server serves both the API and the built `dist/` frontend.

## Database migrations

After deploy, run any pending migrations:

```bash
psql $DATABASE_URL -f server/migrations/<file>.sql
```

Or use the Saturn/Railway console to run them once.

## Promote yourself to admin

```sql
UPDATE users SET is_admin = true WHERE email = 'you@example.com';
```
