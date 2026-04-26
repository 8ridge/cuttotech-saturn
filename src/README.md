# URL Shortener - Link Shortening Service

Modern web service for URL shortening with advanced analytics, statistics tracking, and custom domain support.

> 🚀 **New Ubuntu 22 Server User?** Start with **[UBUNTU_INSTALL.md](./UBUNTU_INSTALL.md)** for 5-minute setup!

---

## 🚀 Quick Start

### ⚡ Ubuntu 22 Server - Fast Installation (5 minutes!)
🎯 **[БЫСТРЫЙ_СТАРТ.md](./БЫСТРЫЙ_СТАРТ.md)** - Installation via automated script
📖 **[UBUNTU_INSTALL.md](./UBUNTU_INSTALL.md)** - Complete guide for Ubuntu 22

### 🗺️ Not sure where to start?
🗺️ **[CHOOSE_YOUR_PATH.md](./CHOOSE_YOUR_PATH.md)** - Interactive installation path guide

### ⚡ In 5 minutes (locally)
📖 **[QUICK_START.md](./QUICK_START.md)** - Minimal setup for quick launch

### 🖥️ Complete Ubuntu server guide
🖥️ **[SERVER_DEPLOYMENT.md](./SERVER_DEPLOYMENT.md)** - Detailed guide with explanations

### For local development
📖 **[INSTALLATION.md](./INSTALLATION.md)** - Simple step-by-step instructions

### For production deployment
🚀 **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment guide with domain

### All documentation
📚 **[DOCS_INDEX.md](./DOCS_INDEX.md)** - Navigation through all documentation

---

## 🎯 Features

### Core Functionality
- ✅ **URL Shortening** - convert long links into short codes
- ✅ **Limits for anonymous users** - up to 5 links without registration
- ✅ **Unlimited usage** after registration
- ✅ **Automatic redirection** via short codes

### Authentication and Security
- ✅ **Email registration** - standard form (name, email, password)
- ✅ **Social auth** - Google, Facebook, Telegram (requires setup)
- ✅ **Email confirmation** - automatic when SMTP is configured
- ✅ **Secure storage** of data in Supabase

### Statistics and Analytics
- ✅ **Click tracking** - number of clicks for each link
- ✅ **Geolocation** - country and city detection by IP address
- ✅ **Timestamps** - date and time of each click
- ✅ **User Agent** - browser and device information
- ✅ **Personal dashboard** - view all links and statistics

### Admin Panel
- ✅ **List of all links** in the system
- ✅ **Delete links** by admin
- ✅ **View statistics** of any links
- ✅ **User management**

### Additional Features
- ✅ **Responsive design** - works on all devices
- ✅ **Copy to clipboard** - quick link copying
- ✅ **Toast notifications** - informative action messages

## 🛠 Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - type safety
- **Tailwind CSS** - styling
- **shadcn/ui** - UI components
- **Lucide React** - icons
- **Sonner** - toast notifications

### Backend
- **Supabase Edge Functions** - serverless backend
- **Deno** - runtime for Edge Functions
- **Hono** - web framework
- **PostgreSQL** - database (via KV Store)
- **Supabase Auth** - authentication

### External Services
- **ipapi.co** - geolocation by IP
- **Let's Encrypt** - SSL certificates
- **Nginx** - reverse proxy and web server

## 📋 Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────────┐
│    Nginx    │─────▶│  React Frontend  │
│  (SSL/443)  │      │   (Static SPA)   │
└──────┬──────┘      └──────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   Supabase Edge Functions   │
│      (Hono API Server)      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│    PostgreSQL Database      │
│      (KV Store Table)       │
└─────────────────────────────┘
```

## 🔧 Quick Start (Development)

### Prerequisites
- Node.js 20 or higher
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd url-shortener
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Create `.env.local` (or `.env`) with your Supabase credentials.  
   You can copy values from the provided `publickkey.env` file:
```env
VITE_SUPABASE_PROJECT_ID=cynaahwuoewjgzryslra
VITE_SUPABASE_URL=https://cynaahwuoewjgzryslra.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: reuse the same key for reverse proxies (Nginx) and scripts
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Run the dev server (same command is used in production-like environments):
```bash
npm run dev -- --host 0.0.0.0 --port 3000
```

5. Open browser: http://localhost:5173

## 🚀 Production Deployment

Detailed deployment instructions are in **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**.

### Deployment options:

1. **Vercel/Netlify** - Fast and easy way
2. **Own server** - Full control
3. **Supabase Edge Functions** - Serverless backend

See **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** for details.

## 📦 Building for Production

### On Ubuntu 22 Server

1. Install Node.js 20:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Build the project:
```bash
npm run build
```

4. Preview the build (optional):
```bash
npm run preview -- --host 0.0.0.0 --port 3000
```

The built files will be in the `dist/` directory, ready for deployment with Nginx.

## 📊 Database Structure (KV Store)

The application uses Supabase KV Store for data storage:

```
Keys structure:

# URL data
url:{shortCode} → {originalUrl, userId, createdAt, customDomain}

# Click statistics
stats:{shortCode}:{timestamp} → {ip, country, city, userAgent, timestamp}

# User URLs
user:{userId}:urls → [shortCode1, shortCode2, ...]

# Counter for anonymous
anon:{fingerprint}:count → number

# Admin flags
admin:{userId} → "true"
```

## 🔐 API Endpoints

### Backend API (Edge Functions)

**Base URL**: `https://{project-id}.supabase.co/functions/v1/make-server-90636d20`

#### POST `/shorten`
Create short link

**Request:**
```json
{
  "url": "https://example.com/very/long/url",
  "fingerprint": "optional-browser-fingerprint"
}
```

**Response:**
```json
{
  "shortCode": "abc123",
  "shortUrl": "https://yoursite.com/abc123"
}
```

#### GET `/redirect/:code`
Returns **HTTP 302** with the `Location` header pointing to the original URL.  
No JSON payload is returned – clients should follow the redirect automatically.

#### GET `/stats/:code`
Get link statistics (requires authentication)

**Response:**
```json
{
  "shortCode": "abc123",
  "originalUrl": "https://example.com/...",
  "createdAt": "2025-01-01T00:00:00Z",
  "totalClicks": 42,
  "stats": [
    {
      "ip": "192.168.1.1",
      "country": "Russia",
      "city": "Moscow",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2025-01-01T12:00:00Z"
    }
  ]
}
```

#### GET `/user/urls`
Get all user URLs (requires authentication)

#### DELETE `/url/:code`
Delete link (requires authentication)

#### POST `/signup`
Register new user

**Request:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "secure-password"
}
```

#### GET `/admin/urls`
Get all links (admins only)

#### POST `/domain/custom`
Configure custom domain (requires authentication)

## ⚡ Instant Redirect Proxying

- **Development**: `vite.config.ts` includes a middleware that intercepts requests like `/abc123` (short codes up to 7 characters) and proxies them straight to the Supabase Edge Function.  
  This keeps local testing identical to production and forwards both `Authorization` and `apikey` headers automatically.

- **Production**: update your reverse proxy (see `src/nginx.conf`) to route the same pattern to  
  `https://cynaahwuoewjgzryslra.supabase.co/functions/v1/make-server-90636d20/redirect/$shortCode`, forwarding:
  - `Authorization: Bearer $SUPABASE_ANON_KEY`
  - `apikey: $SUPABASE_ANON_KEY`
  - `X-Forwarded-For` / `X-Real-IP`

  Declare `env SUPABASE_ANON_KEY;` in the main `nginx.conf` so the key is injected securely at runtime.

**Request:**
```json
{
  "shortCode": "abc123",
  "domain": "link.mysite.com"
}
```

## 🎨 Components

### Main Components

- **Header** - site header with navigation and authentication
- **HomePage** - main page with URL shortening form
- **AuthModal** - registration/login modal window
- **Dashboard** - user personal dashboard
- **StatsView** - detailed link statistics
- **AdminPanel** - administrative panel
- **SettingsPage** - custom domain settings

### UI Components (shadcn/ui)

Ready-made components from `/components/ui/`:
- Button, Input, Card, Table, Badge
- Dialog, Tabs, Label, Toaster
- And more...

## 🔒 Security

### Implemented security measures:

1. **Authentication** via Supabase Auth
2. **HTTPS** mandatory via Let's Encrypt
3. **Rate Limiting** in Nginx
4. **CORS** configured in Edge Functions
5. **SQL Injection** protection via Supabase ORM
6. **XSS protection** via React and Content Security Policy
7. **Secure Headers** in Nginx configuration

### Production recommendations:

- ✅ Use strong passwords for DB
- ✅ Store secret keys in environment variables
- ✅ Enable Fail2Ban for brute force protection
- ✅ Regularly update dependencies
- ✅ Set up monitoring and alerts
- ✅ Make regular backups

## 📈 Scaling

### Recommendations for high loads:

1. **CDN** - use Cloudflare for caching
2. **Load Balancer** - for load distribution
3. **Database Pooling** - Supabase supports connection pooling
4. **Horizontal Scaling** - Edge Functions scale automatically
5. **Caching** - Redis for caching frequent requests
6. **Monitoring** - Sentry, DataDog, or New Relic

## 🐛 Troubleshooting

### Common issues:

**Problem**: Social auth doesn't work
**Solution**: Make sure you've configured OAuth apps in Google/Facebook and added correct redirect URIs in Supabase

**Problem**: CORS errors
**Solution**: Check that Edge Function uses `cors()` middleware

**Problem**: Geolocation shows "unknown"
**Solution**: ipapi.co has request limits. Consider paid plan or alternative service

**Problem**: SSL doesn't work
**Solution**: Check that DNS records are configured correctly and enough time has passed for propagation

## 📝 License

MIT License - freely use in your projects

## 🤝 Contributing

Pull Requests are welcome! Please:
1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📧 Contacts

For questions and suggestions, create an Issue in the repository.

---

**Made with ❤️ using React, TypeScript, Tailwind CSS and Supabase**
