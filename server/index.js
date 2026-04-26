// URL Shortener Backend API Server
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool, * as db from './db.js';
import * as emailService from './email.js';
import { clientUuidMiddleware } from './middleware/clientUuid.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { processClick } from './services/monetizationService.js';
import logger from './utils/logger.js';
import geoip from 'geoip-lite';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy to get real IP addresses (important for geolocation)
app.set('trust proxy', true);

// Geolocation cache: IP -> { country, city, timestamp }
// Cache TTL: 24 hours (86400000 ms)
const geolocationCache = new Map();
const GEOLOCATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup cache every hour (remove expired entries)
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of geolocationCache.entries()) {
    if (now - data.timestamp > GEOLOCATION_CACHE_TTL) {
      geolocationCache.delete(ip);
    }
  }
  if (geolocationCache.size > 0) {
    console.log(`🧹 Geolocation cache cleanup: ${geolocationCache.size} entries remaining`);
  }
}, 60 * 60 * 1000); // Every hour

// Middleware
// Request logger MUST be first to generate requestId for all subsequent middleware
app.use(requestLoggerMiddleware);

app.use(cors({
  origin: '*', // Allow all origins for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey']
}));
app.use(cookieParser());
app.use(express.json());
// Client UUID middleware - must be before all API routes
app.use(clientUuidMiddleware);
// Add error handler for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // #region agent log
    import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:33',message:'JSON parse error',data:{error:err.message,path:req.path,method:req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})+'\n').catch(()=>{})).catch(()=>{});
    // #endregion
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next();
});

// Path to dist folder (frontend)
const distPath = path.join(__dirname, '..', 'dist');
const distExists = fs.existsSync(distPath);

// Log dist folder status
if (!distExists) {
  logger.info({ event: 'dist_check', status: 'not_found', mode: 'development' });
} else {
  logger.info({ event: 'dist_check', status: 'found', mode: 'production' });
}

// Base URL for short links
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// JWT Secret for token generation (use a strong secret in production!)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/auth/google/callback`;

const googleOAuthClient = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
  ? new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  : null;

// Generate JWT token for user
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
function verifyToken(token) {
  if (!token) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    if (error.name === 'TokenExpiredError') {
      console.log('⚠️ Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('⚠️ Invalid token format:', error.message);
      console.log('⚠️ Token preview:', token.substring(0, 50) + '...');
      console.log('⚠️ JWT_SECRET length:', JWT_SECRET?.length || 0);
    } else {
      console.log('⚠️ Token verification error:', error.name, error.message);
    }
    return null;
  }
}

// Generate short code from number
function generateShortCode(num) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  let n = num;
  while (n > 0) {
    result = chars[n % 62] + result;
    n = Math.floor(n / 62);
  }
  return result || '0';
}

// Detect device type from user agent
function detectDevice(userAgent) {
  if (!userAgent || userAgent === 'unknown') {
    return 'Unknown';
  }
  
  const ua = userAgent.toLowerCase();
  
  // Mobile devices
  if (/mobile|android|iphone|ipod|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec/i.test(ua)) {
    if (/iphone|ipod/i.test(ua)) {
      return 'iPhone';
    }
    if (/ipad/i.test(ua)) {
      return 'iPad';
    }
    if (/android/i.test(ua)) {
      return 'Android Phone';
    }
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      return 'Tablet';
    }
    return 'Mobile';
  }
  
  // Tablets
  if (/tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(ua)) {
    if (/ipad/i.test(ua)) {
      return 'iPad';
    }
    return 'Tablet';
  }
  
  // Desktop/Laptop
  if (/windows|macintosh|linux|ubuntu|fedora|debian/i.test(ua)) {
    if (/macintosh|mac os x/i.test(ua)) {
      return 'Mac';
    }
    if (/windows/i.test(ua)) {
      return 'Windows PC';
    }
    if (/linux/i.test(ua)) {
      return 'Linux PC';
    }
    return 'Desktop';
  }
  
  // Other devices
  if (/tv|smart-tv|smarttv|appletv|googletv|hbbtv|philipstv|bravia|netcast|viera|nettv|roku|boxee|kylo|mediaroom|ce-html/i.test(ua)) {
    return 'Smart TV';
  }
  
  if (/bot|crawler|spider|scraper/i.test(ua)) {
    return 'Bot';
  }
  
  return 'Desktop'; // Default fallback
}

// Get user from access token (JWT)
async function getUserFromToken(accessToken) {
  // #region agent log
  fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:203',message:'getUserFromToken entry',data:{hasToken:!!accessToken,tokenLength:accessToken?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!accessToken) {
    console.log('⚠️ [getUserFromToken] No access token provided');
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:206',message:'getUserFromToken no token',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return null;
  }
  
  // First, try JWT token (local authentication)
  const jwtPayload = verifyToken(accessToken);
  // #region agent log
  fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:213',message:'JWT verification result',data:{hasPayload:!!jwtPayload,hasUserId:!!jwtPayload?.id,userId:jwtPayload?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (jwtPayload && jwtPayload.id) {
    const user = await db.getUserById(jwtPayload.id);
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:216',message:'DB user lookup result',data:{found:!!user,userId:jwtPayload.id,userEmail:user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (user) {
      // #region agent log
      fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:218',message:'getUserFromToken success JWT',data:{userId:user.id,userEmail:user.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return {
        id: user.id,
        email: user.email,
        user_metadata: { name: user.name }
      };
    } else {
      console.log('⚠️ [getUserFromToken] User not found in database for ID:', jwtPayload.id);
    }
  } else {
    console.log('⚠️ [getUserFromToken] JWT verification failed');
  }
  
  console.log('❌ [getUserFromToken] Authentication failed, returning null');
  // #region agent log
  fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:262',message:'getUserFromToken failed all methods',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return null;
}

// ==================== Routes ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple test endpoint to verify server is working
app.post('/test-endpoint', (req, res) => {
  console.log('✅ [TEST] /test-endpoint called');
  res.json({ success: true, message: 'Server is working', timestamp: new Date().toISOString() });
});

// Debug endpoint to test logging and database connection
app.get('/debug/test', async (req, res) => {
  console.log('🔍 [DEBUG] /debug/test endpoint called');
  const testResults = {
    server: 'ok',
    timestamp: new Date().toISOString(),
    logFile: 'checking...',
    database: 'checking...'
  };
  
  // Test log file
  try {
    const fs = await import('fs');
    const path = await import('path');
    const logPath = '/home/ci97979/www/CuttoTech/.cursor/debug.log';
    const logDir = path.dirname(logPath);
    await fs.promises.mkdir(logDir, { recursive: true });
    await fs.promises.appendFile(logPath, JSON.stringify({test: true, timestamp: Date.now()})+'\n');
    testResults.logFile = 'ok - file created';
  } catch (logErr) {
    testResults.logFile = `error: ${logErr.message}`;
  }
  
  // Test database connection and email_tokens table
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM email_tokens');
    testResults.database = `ok - table exists, ${result.rows[0].count} tokens`;
  } catch (dbErr) {
    if (dbErr.code === '42P01') {
      testResults.database = 'error: email_tokens table does not exist - migration required';
    } else {
      testResults.database = `error: ${dbErr.message} (code: ${dbErr.code})`;
    }
  }
  
  res.json(testResults);
});

// Sign up endpoint (local authentication)
app.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    console.log('📝 Signup request for:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address has already been registered' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user in local database
    const user = await db.createUser(email, passwordHash, name);
    
    console.log('✅ User created successfully:', user.id);

    // Generate email verification token
    const verificationToken = emailService.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiry
    
    // Store verification token in database
    try {
      await db.createEmailToken(user.id, verificationToken, 'email_verification', expiresAt);
      
      // Send verification email (don't block signup if email fails)
      try {
        await emailService.sendVerificationEmail(user.email, user.name, verificationToken);
        console.log('✅ Verification email sent to:', user.email);
      } catch (emailError) {
        console.error('❌ Failed to send verification email:', emailError);
        // Don't fail signup if email fails
      }
    } catch (tokenError) {
      console.error('❌ Failed to create verification token:', tokenError);
      if (tokenError.message && tokenError.message.includes('migration')) {
        console.error('⚠️  Please run database migration: psql -U urlshortener -d urlshortener -f server/migrations/add_email_tokens.sql');
      }
      // Don't fail signup if token creation fails - user can still login
    }

    // Check if user is admin (usually false for new users, but check anyway)
    const userIsAdmin = await db.isAdmin(user.id);

    // Generate JWT token
    const token = generateToken(user);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified,
        created_at: user.created_at,
        is_admin: userIsAdmin,
      },
      access_token: token,
    });
  } catch (error) {
    console.error('❌ Signup processing error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Failed to sign up', details: error.message });
  }
});

// Login endpoint (local authentication)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Login request for:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from database
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    console.log('✅ Login successful for user:', user.id);

    // Check if user is admin
    const userIsAdmin = await db.isAdmin(user.id);

    // Generate JWT token
    const token = generateToken(user);

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified,
        created_at: user.created_at,
        is_admin: userIsAdmin,
      },
      access_token: token,
    });
  } catch (error) {
    console.error('❌ Login processing error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Failed to login', details: error.message });
  }
});

// Google OAuth - Initiate login
app.get('/auth/google', (req, res) => {
  if (!googleOAuthClient) {
    return res.status(500).json({ error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.' });
  }

  const state = jwt.sign({ redirect: req.query.redirect || '/' }, JWT_SECRET, { expiresIn: '10m' });
  const authUrl = googleOAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    state: state,
    prompt: 'consent',
  });

  res.redirect(authUrl);
});

// Google OAuth - Callback
app.get('/auth/google/callback', async (req, res) => {
  try {
    console.log('🔐 Google OAuth callback received');
    
    if (!googleOAuthClient) {
      console.error('❌ Google OAuth client not configured');
      return res.status(500).json({ error: 'Google OAuth is not configured' });
    }

    const { code, state } = req.query;
    console.log('📥 Callback params:', { hasCode: !!code, hasState: !!state });

    if (!code) {
      console.error('❌ Authorization code not provided');
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // Verify state token
    let redirectPath = '/';
    try {
      const decoded = jwt.verify(state, JWT_SECRET);
      redirectPath = decoded.redirect || '/';
      console.log('✅ State token verified, redirect path:', redirectPath);
    } catch (err) {
      console.error('❌ Invalid state token:', err.message);
      // Continue with default redirect path
    }

    console.log('🔄 Exchanging code for tokens...');
    // Exchange code for tokens
    const { tokens } = await googleOAuthClient.getToken(code);
    googleOAuthClient.setCredentials(tokens);
    console.log('✅ Tokens received from Google');

    // Get user info from Google
    console.log('🔄 Verifying ID token...');
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      console.error('❌ Failed to get user payload from Google');
      return res.status(400).json({ error: 'Failed to get user info from Google' });
    }

    const googleEmail = payload.email;
    const googleName = payload.name || payload.given_name || '';
    const googleId = payload.sub;

    console.log('👤 Google user info:', { email: googleEmail, name: googleName });

    if (!googleEmail) {
      console.error('❌ Email not provided by Google');
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    // Check if user exists in local database
    let user = await db.getUserByEmail(googleEmail);
    
    if (!user) {
      // Create new user without password (OAuth user)
      console.log('🔄 Creating new OAuth user:', googleEmail);
      user = await db.createUserWithoutPassword(googleEmail, googleName, null);
      console.log('✅ New OAuth user created:', user.id);
    } else {
      console.log('✅ Existing user found:', user.id);
      // Update name if it changed
      if (googleName && user.name !== googleName) {
        await db.updateUser(user.id, { name: googleName });
        user.name = googleName;
      }
    }

    // Generate JWT token for the user
    const token = generateToken(user);
    console.log('✅ JWT token generated for user:', user.email);

    // Redirect to frontend with token
    const frontendUrl = new URL(redirectPath, BASE_URL);
    frontendUrl.searchParams.set('token', token);
    frontendUrl.searchParams.set('oauth', 'google');

    console.log('🚀 Redirecting to frontend:', frontendUrl.toString());
    res.redirect(frontendUrl.toString());
  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'OAuth authentication failed', details: error.message });
  }
});

// Shorten URL endpoint
app.post('/shorten', async (req, res) => {
  try {
    const { 
      url, 
      fingerprint, 
      shortCode: customShortCode, 
      customDomain,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      gclid,
      referrer
    } = req.body;
    console.log(`📝 POST /shorten - url=${url?.substring(0, 50)}..., fingerprint=${fingerprint ? fingerprint.substring(0, 16) + '...' : 'null'}, hasUser=${!!req.headers.authorization}, campaign=${utm_campaign || 'none'}`);

    if (!url || !url.match(/^https?:\/\/.+/)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    // Anonymous user limit
    // Prefer server-side, httpOnly cookie-based UUID (req.clientUuid) to prevent client bypass.
    const anonKey = !user ? (req.clientUuid || fingerprint || null) : null;

    // Get limit settings from database
    const limitEnabled = await db.getLimitSetting('anonymous_limit_enabled');
    // Default to enabled if setting is missing; only explicit 'false' disables.
    const isLimitEnabled = limitEnabled !== 'false';

    const maxLinksSetting = await db.getLimitSetting('anonymous_limit_max');
    const parsedMaxLinks = parseInt((maxLinksSetting ?? '').toString(), 10);
    // Defensive defaults: if setting is missing/invalid/too small, fall back to 5.
    const MAX_LINKS = Number.isFinite(parsedMaxLinks) && parsedMaxLinks >= 1 ? parsedMaxLinks : 5;

    if (!user && isLimitEnabled && !anonKey) {
      // If limit is enabled, anonymous requests must be attributable to an anonKey
      return res.status(400).json({
        error: 'missing_fingerprint',
        message: 'Fingerprint is required for guest users when limits are enabled.',
      });
    }

    // Custom short code is only available for authenticated users
    if (customShortCode && !user) {
      return res.status(401).json({ error: 'Custom short code requires authentication' });
    }

    // Validate custom short code if provided
    let shortCode = '';
    if (customShortCode) {
      // Only allow alphanumeric and hyphens, 1-7 characters (matching database VARCHAR(7) constraint)
      // Trim whitespace and validate
      const trimmedCode = customShortCode.trim();
      if (!trimmedCode || !/^[a-zA-Z0-9-]{1,7}$/.test(trimmedCode)) {
        return res.status(400).json({ error: 'Invalid short code format. Use only letters, numbers, and hyphens (1-7 characters)' });
      }
      
      // Check if code already exists
      const existing = await db.getUrlByShortCode(trimmedCode);
      if (existing) {
        return res.status(409).json({ error: 'Short code already exists' });
      }
      
      // Use trimmed code
      shortCode = trimmedCode;
    }

    // Generate unique short code if not provided
    let attempts = 0;
    const maxAttempts = 10;

    if (!shortCode) {
      while (attempts < maxAttempts) {
        const randomNum = Math.floor(Math.random() * 100000000) + Date.now();
        shortCode = generateShortCode(randomNum).slice(0, 7);
        const existing = await db.getUrlByShortCode(shortCode);
        if (!existing) break;
        attempts++;
      }

      if (attempts === maxAttempts) {
        return res.status(500).json({ error: 'Failed to generate unique code' });
      }
    }

    // Extract creator IP and UUID for monetization tracking
    const creatorIp = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.ip || null;
    const creatorToken = req.clientUuid || null;

    // Store URL (anonymous: enforce limit atomically, authenticated: plain insert)
    if (!user && isLimitEnabled) {
      try {
        await db.createUrlWithAnonymousLimit({
          anonKey,
          maxLinks: MAX_LINKS,
          shortCode,
          originalUrl: url,
          userId: null,
          customDomain: customDomain || null,
          creatorIp: creatorIp !== 'unknown' ? creatorIp : null,
          creatorToken,
          utmSource: utm_source || null,
          utmMedium: utm_medium || null,
          utmCampaign: utm_campaign || null,
          utmContent: utm_content || null,
          utmTerm: utm_term || null,
          gclid: gclid || null,
          referrer: referrer || null,
        });
      } catch (e) {
        if (e?.code === 'LIMIT_REACHED' || e?.message === 'limit_reached') {
          console.log(`❌ Anonymous limit reached for anonKey: ${(anonKey || '').toString().substring(0, 16)}...`);
          return res.status(403).json({
            error: 'limit_reached',
            message: `You have reached the limit of ${MAX_LINKS} links for guest users. Register to create unlimited links!`,
          });
        }
        throw e;
      }
    } else {
      await db.createUrl(
        shortCode,
        url,
        user?.id || null,
        customDomain || null,
        creatorIp !== 'unknown' ? creatorIp : null,
        creatorToken,
        utm_source || null,
        utm_medium || null,
        utm_campaign || null,
        utm_content || null,
        utm_term || null,
        gclid || null,
        referrer || null
      );

      // Best-effort increment for anonymous when limit is disabled (keeps admin stats consistent)
      if (!user && anonKey && !isLimitEnabled) {
        await db.incrementAnonymousCount(anonKey);
      }
    }

    return res.json({
      shortCode,
      shortUrl: `${BASE_URL}/${shortCode}`,
    });
  } catch (error) {
    console.error('Shorten URL error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to shorten URL',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Redirect endpoint (for API calls)
app.get('/redirect/:code', async (req, res) => {
  try {
    const shortCode = req.params.code;
    const urlRecord = await db.getUrlByShortCode(shortCode);

    if (!urlRecord) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // --- ВНЕДРЕНИЕ МОНЕТИЗАЦИИ ---
    // NOTE: This processClick() handles backend monetization (WAP offers for Nigeria/Pakistan)
    // Process monetization logic (determine if offer should be shown)
    const { redirectUrl } = await processClick(urlRecord, req);

    // Get IP and location info (with trust proxy, req.ip should work correctly)
    let ip = req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip']?.trim() || 
             req.connection?.remoteAddress ||
             req.socket?.remoteAddress ||
             'unknown';
    
    // Remove IPv6 prefix if present
    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }
    
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    console.log('🔍 IP detection for redirect:', {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'req.ip': req.ip,
      'remoteAddress': req.connection?.remoteAddress || req.socket?.remoteAddress,
      'final_ip': ip
    });

    // Fetch geolocation data - try cache first, then APIs
    let country = 'Unknown';
    let city = 'Unknown';
    
    // Skip geolocation for local/private IPs
    const isLocalIP = ip === 'unknown' || 
      !ip ||
      ip.startsWith('127.') || 
      ip.startsWith('::1') || 
      ip.startsWith('192.168.') || 
      ip.startsWith('10.') || 
      ip.startsWith('172.') ||
      ip.startsWith('169.254.');
    
    if (isLocalIP) {
      console.log('⚠️ Skipping geolocation for local/private IP:', ip);
      // For testing: try to get a test IP if we're in development
      if (process.env.NODE_ENV !== 'production' && ip === 'unknown') {
        console.log('🧪 Development mode: Using test IP for geolocation');
        ip = '8.8.8.8'; // Google DNS for testing
      } else {
        // Keep country as Unknown for local IPs
        country = 'Unknown';
        city = 'Unknown';
      }
    }
    
    if (!isLocalIP || (process.env.NODE_ENV !== 'production' && ip === '8.8.8.8')) {
      // Check cache first
      const cached = geolocationCache.get(ip);
      if (cached && (Date.now() - cached.timestamp) < GEOLOCATION_CACHE_TTL) {
        country = cached.country;
        city = cached.city;
        console.log('✅ Using cached geolocation for IP:', ip, { country, city });
      } else {
        console.log('🌍 Fetching geolocation for IP:', ip);
      
      // Try ip-api.com first (more reliable and free)
      try {
        console.log('🌍 Calling ip-api.com for IP:', ip);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        const altResponse = await fetch(`https://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,regionName`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (altResponse.ok) {
          const altData = await altResponse.json();
          console.log('🌍 ip-api.com response:', JSON.stringify(altData).substring(0, 300));
          
          if (altData.status === 'success' && altData.country) {
            country = altData.country;
            city = altData.city || altData.regionName || 'Unknown';
            // Cache the result
            geolocationCache.set(ip, { country, city, timestamp: Date.now() });
            console.log('✅ Using ip-api.com result:', { country, city, countryCode: altData.countryCode });
          } else {
            console.warn('⚠️ ip-api.com returned no country:', altData.message || 'Unknown error');
          }
        } else if (altResponse.status === 429) {
          console.warn('⚠️ ip-api.com rate limit exceeded (429), skipping');
        } else {
          console.error('❌ ip-api.com HTTP error:', altResponse.status, altResponse.statusText);
        }
      } catch (altError) {
        if (altError.name === 'AbortError') {
          console.warn('⚠️ ip-api.com request timeout');
        } else {
          console.error('❌ ip-api.com error:', altError.message);
        }
      }
      
      // If ip-api.com failed, try ipapi.co as fallback
      if (country === 'Unknown') {
        try {
        console.log('🌍 Calling ipapi.co for IP:', ip);
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 3000); // 3 second timeout
        const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);
          
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            console.log('🌍 ipapi.co response:', JSON.stringify(geoData).substring(0, 300));
            
            if (!geoData.error && (geoData.country_name || geoData.country)) {
              country = geoData.country_name || geoData.country || 'Unknown';
              city = geoData.city || 'Unknown';
              // Cache the result
              geolocationCache.set(ip, { country, city, timestamp: Date.now() });
              console.log('✅ Using ipapi.co result:', { country, city, countryCode: geoData.country_code });
            } else {
              console.error('❌ ipapi.co error:', geoData.reason || geoData.error);
            }
          } else if (geoResponse.status === 429) {
            console.warn('⚠️ ipapi.co rate limit exceeded (429), skipping');
          } else {
            console.error('❌ ipapi.co HTTP error:', geoResponse.status, geoResponse.statusText);
          }
        } catch (geoError) {
          if (geoError.name === 'AbortError') {
            console.warn('⚠️ ipapi.co request timeout');
          } else {
            console.error('❌ ipapi.co error:', geoError.message);
          }
        }
      }
      
        // Final check - if still Unknown, try geoip-lite as last resort (returns country code only)
        if (country === 'Unknown') {
          try {
            const geo = geoip.lookup(ip);
            if (geo && geo.country) {
              // geoip-lite returns country code, not full name
              // We'll use the code as fallback (e.g., "US" instead of "United States")
              country = geo.country;
              console.log('✅ Using geoip-lite fallback (country code only):', country);
              // Cache even the code to avoid repeated lookups
              geolocationCache.set(ip, { country, city: 'Unknown', timestamp: Date.now() });
            } else {
              console.warn('⚠️ All geolocation methods failed for IP:', ip);
            }
          } catch (geoipError) {
            console.warn('⚠️ All geolocation methods failed for IP:', ip, geoipError.message);
          }
        }
      }
    }

    // Ensure country is properly capitalized (not 'unknown' lowercase)
    if (country && country.toLowerCase() === 'unknown') {
      country = 'Unknown';
    }
    if (city && city.toLowerCase() === 'unknown') {
      city = 'Unknown';
    }

    // Detect device type
    const device = detectDevice(userAgent);
    console.log('📱 Device detection:', { userAgent: userAgent.substring(0, 80), device });
    
    // Debug logging
    console.log('📊 Storing stat:', { ip, country, city, device, userAgent: userAgent.substring(0, 50) });

    // Store statistics (device instead of full user agent)
    // Ensure we store 'Unknown' (capitalized) not 'unknown'
    const statResult = await db.createStat(
      urlRecord.id,
      ip,
      country || 'Unknown',
      city || 'Unknown',
      device
    );
    
    console.log('✅ Stat stored in DB:', { 
      id: statResult.id, 
      country: statResult.country, 
      user_agent: statResult.user_agent,
      city: statResult.city
    });

    // Perform HTTP redirect - use redirectUrl from monetization service
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    return res.status(500).json({ error: 'Failed to redirect' });
  }
});

// Get statistics endpoint
// Stats endpoint - support both /stats/:code (legacy) and /api/stats/:code (for Nginx routing)
const handleStatsRequest = async (req, res) => {
  try {
    const shortCode = req.params.code;
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    const urlRecord = await db.getUrlByShortCode(shortCode);
    if (!urlRecord) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Check if user owns this URL or is admin
    const isOwner = user?.id === urlRecord.user_id;
    const userIsAdmin = user ? await db.isAdmin(user.id) : false;

    if (!isOwner && !userIsAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get stats
    const stats = await db.getStatsByUrlId(urlRecord.id);
    
    console.log('📊 Fetching stats for shortCode:', shortCode, 'Found:', stats.length, 'records');
    if (stats.length > 0) {
      console.log('📊 Sample stat from DB:', {
        id: stats[0].id,
        country: stats[0].country,
        user_agent: stats[0].user_agent,
        city: stats[0].city,
        ip_address: stats[0].ip_address
      });
    }

    const processedStats = stats.map(s => {
      // Handle old data: if user_agent looks like a full user agent string, detect device from it
      // Otherwise, it's already a device type
      let device = s.user_agent || 'Unknown';
      if (!device || device.trim() === '') {
        device = 'Unknown';
      } else {
        // Check if it's a full user agent string (longer than 50 chars or contains browser identifiers)
        const isFullUserAgent = device.length > 50 || 
          device.includes('Mozilla') || 
          device.includes('Chrome') || 
          device.includes('Safari') || 
          device.includes('Firefox') || 
          device.includes('Edg') || 
          device.includes('Opera') ||
          device.includes('Version/') ||
          device.includes('Gecko/');
        
        if (isFullUserAgent) {
          // This is a full user agent, convert it to device type
          device = detectDevice(device);
          console.log('🔄 Converted user agent to device:', { 
            original: s.user_agent.substring(0, 50), 
            device 
          });
        }
        // Otherwise, it's already a device type (like "Windows PC", "iPhone", etc.)
      }
      
      // Normalize country: convert "unknown" to "Unknown" for consistency
      let country = s.country || 'Unknown';
      if (!country || country.trim() === '' || country.toLowerCase() === 'unknown' || country.toLowerCase() === 'null') {
        country = 'Unknown';
      } else {
        // Capitalize first letter for consistency
        country = country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
      }
      
      // Debug logging for empty values
      if (device === 'Unknown' || country === 'Unknown') {
        console.log('⚠️ Empty stat values:', { 
          id: s.id, 
          raw_country: s.country, 
          raw_user_agent: s.user_agent, 
          processed_device: device, 
          processed_country: country 
        });
      }
      
      return {
        country,
        device,
        timestamp: s.created_at,
        ip: s.ip_address || null,
      };
    });
    
    console.log('📊 Returning processed stats:', processedStats.length, 'records');
    if (processedStats.length > 0) {
      console.log('📊 Sample processed stat:', processedStats[0]);
    }

    // Ensure we're returning the correct format
    const finalStats = processedStats.map(stat => ({
      country: stat.country,
      device: stat.device,
      timestamp: stat.timestamp,
      ip: stat.ip || null,
    }));
    
    console.log('📊 Final stats being returned:', finalStats.length, 'records');
    if (finalStats.length > 0) {
      console.log('📊 Final sample stat:', JSON.stringify(finalStats[0]));
    }

    return res.json({
      shortCode,
      originalUrl: urlRecord.original_url,
      createdAt: urlRecord.created_at,
      totalClicks: stats.length,
      stats: finalStats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({ error: 'Failed to get statistics' });
  }
};

// Register both endpoints: /api/stats/:code (for Nginx routing) and /stats/:code (legacy)
app.get('/api/stats/:code', handleStatsRequest);

// Handle /stats/:code - differentiate between API requests and browser page refreshes
// API requests have Authorization header, browser requests don't
app.get('/stats/:code', (req, res, next) => {
  // If this is an API request (has Authorization header), handle as API
  if (req.headers.authorization) {
    return handleStatsRequest(req, res);
  }
  
  // This is a browser request (page refresh), serve the SPA
  if (distExists) {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log('📄 SPA: Serving index.html for /stats/:code (browser refresh)');
      return res.sendFile(indexPath);
    }
  }
  
  // Fallback if index.html doesn't exist
  return res.status(404).json({ error: 'Frontend not built. Please run "npm run build".' });
});

// Get user's URLs
// IMPORTANT: This route MUST be defined BEFORE the /:code wildcard route
app.get('/user/urls', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const accessToken = authHeader.split(' ')[1];
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const user = await getUserFromToken(accessToken);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    console.log(`✅ /user/urls: Loading URLs for user ${user.id} (${user.email})`);
    const urls = await db.getUserUrls(user.id);
    console.log(`📊 Found ${urls.length} URLs for user ${user.id}`);

    // Get click counts for each URL
    const urlsWithStats = await Promise.all(
      urls.map(async (url) => {
        const stats = await db.getStatsByUrlId(url.id);
        return {
          shortCode: url.short_code,
          originalUrl: url.original_url,
          createdAt: url.created_at,
          clicks: stats.length,
          customDomain: url.custom_domain || null,
        };
      })
    );

    return res.json({ urls: urlsWithStats });
  } catch (error) {
    console.error('❌ Get user URLs error:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ error: 'Failed to get URLs', details: error.message });
  }
});

// Delete URL
app.delete('/url/:code', async (req, res) => {
  try {
    const shortCode = req.params.code;
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const urlRecord = await db.getUrlByShortCode(shortCode);
    if (!urlRecord) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Check if user owns this URL or is admin
    const isOwner = user.id === urlRecord.user_id;
    const userIsAdmin = await db.isAdmin(user.id);

    if (!isOwner && !userIsAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Delete URL (cascade will delete stats)
    await db.deleteUrl(shortCode);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete URL error:', error);
    return res.status(500).json({ error: 'Failed to delete URL' });
  }
});

// Admin: Get all URLs
app.get('/admin/urls', async (req, res) => {
  // #region agent log
  fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1077',message:'/admin/urls endpoint called',data:{method:req.method,path:req.path,hasAuth:!!req.headers.authorization,contentType:req.headers['content-type']},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1080',message:'User from token result /admin/urls',data:{hasUser:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const isAdmin = user ? await db.isAdmin(user.id) : false;
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1082',message:'Admin check /admin/urls',data:{isAdmin,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!user || !isAdmin) {
      // #region agent log
      fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1083',message:'Unauthorized /admin/urls',data:{hasUser:!!user,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    // Get filter type from query parameter: 'registered', 'anonymous', or 'all' (default)
    const filterType = req.query.type || 'all';
    
    // Support filtering by specific userId or clientUuid (creator_token)
    const userIdFilter = req.query.userId || null;
    const clientUuidFilter = req.query.clientUuid || null;

    // Use optimized query to get all URLs with stats in a single database query
    // This avoids N+1 query problem and significantly improves performance
    const urlsWithStatsRaw = await db.getAllUrlsWithStatsOptimized(filterType, userIdFilter, clientUuidFilter);

    // Transform to match expected API response format
    const urlsWithStats = urlsWithStatsRaw.map(url => ({
      shortCode: url.short_code,
      originalUrl: url.original_url,
      userId: url.user_id,
      createdAt: url.created_at,
      customDomain: url.custom_domain,
      clicks: url.clicks,
      creatorToken: url.creator_token || null,
      creatorIp: url.creator_ip || null,
      userEmail: url.user_email || undefined,
      userName: url.user_name || undefined,
      clientUuid: url.client_uuid || null,
      usageCount: url.usage_count || undefined,
      remainingLimit: url.remaining_limit || undefined,
      limitReached: url.limit_reached || undefined,
      limitUsage: url.limit_usage || undefined,
    }));
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1100',message:'URLs retrieved successfully',data:{urlCount:urlsWithStats.length,filterType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    return res.json({ urls: urlsWithStats, filterType });
  } catch (error) {
    console.error('Admin get URLs error:', error);
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1105',message:'Admin URLs error',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return res.status(500).json({ error: 'Failed to get URLs' });
  }
});

// Admin: Get all registered users with link counts
// CRITICAL: This route must be registered BEFORE catch-all routes
app.get('/admin/users', async (req, res) => {
  console.log('🔍 [ADMIN] /admin/users endpoint called');
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    const isAdmin = user ? await db.isAdmin(user.id) : false;
    if (!user || !isAdmin) {
      console.log('❌ [ADMIN] /admin/users: Unauthorized');
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    console.log('✅ [ADMIN] /admin/users: Fetching users...');
    const users = await db.getAllUsersWithLinkCounts();
    console.log(`✅ [ADMIN] /admin/users: Returning ${users.length} users`);
    return res.json({ users });
  } catch (error) {
    console.error('❌ [ADMIN] Admin get users error:', error);
    return res.status(500).json({ error: 'Failed to get users' });
  }
});

// Admin: Get aggregated guest users
// CRITICAL: This route must be registered BEFORE catch-all routes
app.get('/admin/guests', async (req, res) => {
  console.log('🔍 [ADMIN] /admin/guests endpoint called');
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    const isAdmin = user ? await db.isAdmin(user.id) : false;
    if (!user || !isAdmin) {
      console.log('❌ [ADMIN] /admin/guests: Unauthorized');
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    console.log('✅ [ADMIN] /admin/guests: Fetching guests...');
    const guests = await db.getAggregatedGuestUsers();
    
    // Add limit usage for each guest
    const MAX_LINKS = 5;
    const guestsWithLimits = guests.map(guest => ({
      ...guest,
      limitUsage: {
        used: guest.usageCount,
        max: MAX_LINKS
      },
      limitReached: guest.usageCount >= MAX_LINKS,
      remainingLimit: Math.max(0, MAX_LINKS - guest.usageCount)
    }));
    
    console.log(`✅ [ADMIN] /admin/guests: Returning ${guestsWithLimits.length} guests`);
    return res.json({ guests: guestsWithLimits });
  } catch (error) {
    console.error('❌ [ADMIN] Admin get guests error:', error);
    return res.status(500).json({ error: 'Failed to get guests' });
  }
});

// Admin: Get overall statistics
// ВАЖНО: Этот эндпоинт доступен ТОЛЬКО для администраторов
// Возвращает общие счетчики системы: общее количество ссылок и переходов
// CRITICAL: This route must be registered BEFORE static middleware and catch-all routes
// IMPORTANT: Register this route with explicit path matching to ensure it's matched before catch-all
// CRITICAL: Register /admin/stats route with explicit matching
// This route MUST be registered before any catch-all routes or static middleware
app.get('/admin/stats', async (req, res) => {
  // CRITICAL: Set content-type immediately to prevent any middleware from changing it
  res.setHeader('Content-Type', 'application/json');
  
  console.log('🚨 [CRITICAL] /admin/stats handler REACHED! Method:', req.method, 'Path:', req.path);
  console.log('🚨 [CRITICAL] Request URL:', req.url, 'Original URL:', req.originalUrl);
  console.log('🚨 [CRITICAL] Full request object:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    headersSent: res.headersSent
  });
  
  // CRITICAL: If headers are already sent, something else handled this request
  if (res.headersSent) {
    console.error('🚨 [CRITICAL ERROR] Response headers already sent! Another handler processed this request!');
    return;
  }
  // #region agent log
  fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1083',message:'/admin/stats endpoint called',data:{method:req.method,path:req.path,hasAuth:!!req.headers.authorization,contentType:req.headers['content-type']},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  console.log('✅ [ROUTE] /admin/stats endpoint CALLED');
  console.log('🔍 [DEBUG] Request details:', {
    method: req.method,
    path: req.path,
    hasAuth: !!req.headers.authorization,
    authHeader: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none'
  });
  
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    console.log('🔍 [DEBUG] Token extracted:', { hasToken: !!accessToken, tokenLength: accessToken?.length });
    
    const user = await getUserFromToken(accessToken);
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1096',message:'User from token result',data:{hasUser:!!user,userId:user?.id,userEmail:user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.log('🔍 [DEBUG] User authenticated:', { hasUser: !!user, userId: user?.id, email: user?.email });

    const isAdmin = user ? await db.isAdmin(user.id) : false;
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1099',message:'Admin check result',data:{isAdmin,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('🔍 [DEBUG] Admin check:', { isAdmin, userId: user?.id });
    
    if (!user || !isAdmin) {
      console.log('❌ [DEBUG] Unauthorized - returning 401');
      // #region agent log
      fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1102',message:'Unauthorized response',data:{hasUser:!!user,isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // CRITICAL: Ensure content-type is JSON and headers are not already sent
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        console.log('✅ [DEBUG] Sending 401 JSON response');
        console.log('✅ [DEBUG] Response headers:', {
          contentType: res.getHeader('Content-Type'),
          headersSent: res.headersSent
        });
        return res.status(401).json({ error: 'Unauthorized - Admin access required' });
      } else {
        console.error('🚨 [ERROR] Headers already sent! Cannot send JSON response.');
      }
      return;
    }

    console.log('🔍 [DEBUG] Getting admin stats from DB...');
    const stats = await db.getAdminStats();
    console.log('✅ [DEBUG] Stats retrieved:', stats);
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1109',message:'Stats retrieved successfully',data:{totalLinks:stats?.totalLinks,totalClicks:stats?.totalClicks},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // CRITICAL: Ensure content-type is set before sending response
    res.setHeader('Content-Type', 'application/json');
    return res.json(stats);
  } catch (error) {
    console.error('❌ [ERROR] Admin get stats error:', error);
    // #region agent log
    fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1113',message:'Admin stats error',data:{errorMessage:error.message,errorStack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // CRITICAL: Ensure content-type is JSON and headers are not already sent
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: 'Failed to get statistics' });
    }
    return;
  }
});

// Admin: Get monetization statistics
// CRITICAL: This route must be registered BEFORE catch-all routes
app.get('/admin/monetization-stats', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);
    
    const isAdmin = user ? await db.isAdmin(user.id) : false;
    
    if (!user || !isAdmin) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    // Get today's date at 00:00:00
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Query 1: Today's clicks with offers shown
    const todayClicksResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM offer_decisions 
       WHERE showed_offer = true 
       AND created_at >= $1`,
      [todayStart]
    );
    const todayClicks = parseInt(todayClicksResult.rows[0].count, 10) || 0;

    // Query 2: Total clicks with offers shown (all time)
    const totalClicksResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM offer_decisions 
       WHERE showed_offer = true`
    );
    const totalClicks = parseInt(totalClicksResult.rows[0].count, 10) || 0;

    // Query 3: Top 5 countries by offer clicks today
    const clicksByCountryResult = await pool.query(
      `SELECT country_code, COUNT(*) as count 
       FROM offer_decisions 
       WHERE showed_offer = true 
       AND created_at >= $1 
       AND country_code IS NOT NULL
       GROUP BY country_code 
       ORDER BY count DESC 
       LIMIT 5`,
      [todayStart]
    );
    const clicksByCountry = clicksByCountryResult.rows.map(row => ({
      country: row.country_code,
      count: parseInt(row.count, 10)
    }));

    return res.json({
      todayClicks,
      totalClicks,
      clicksByCountry
    });
  } catch (error) {
    logger.error({
      event: 'admin_monetization_stats_error',
      error: error.message,
      stack: error.stack
    });
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: 'Failed to get monetization statistics' });
    }
    return;
  }
});

// Get user profile
app.get('/user/profile', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user from local database
    let dbUser = await db.getUserById(user.id);
    
    // If user doesn't exist in local DB (OAuth user),
    // create them in local database
    if (!dbUser && user.email) {
      console.log('🔄 Creating OAuth user in local database:', user.email);
      dbUser = await db.createUserWithoutPassword(
        user.email,
        user.user_metadata?.name || user.name || null,
        user.id
      );
    }

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    // Check if user is admin
    const userIsAdmin = await db.isAdmin(dbUser.id);

    return res.json({
      success: true,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        email_verified: dbUser.email_verified,
        created_at: dbUser.created_at,
        is_admin: userIsAdmin,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to get profile', details: error.message });
  }
});

// Update user profile
app.put('/user/profile', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    let user = await getUserFromToken(accessToken);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user exists in local database
    let dbUser = await db.getUserById(user.id);
    
    // If user doesn't exist in local DB (OAuth user),
    // create them in local database
    if (!dbUser && user.email) {
      console.log('🔄 Creating OAuth user in local database:', user.email);
      dbUser = await db.createUserWithoutPassword(
        user.email,
        user.user_metadata?.name || user.name || null,
        user.id
      );
    }

    if (!dbUser) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const { name, email, currentPassword, newPassword } = req.body;
    const updates = {};

    // Update name if provided
    if (name !== undefined && name !== null) {
      updates.name = name.trim() || null;
    }

    // Update email if provided
    if (email !== undefined && email !== null && email.trim() && email.trim() !== dbUser.email) {
      const emailLower = email.trim().toLowerCase();
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailLower)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      
      // Check if email is already taken
      const existingUser = await db.getUserByEmail(emailLower);
      if (existingUser && existingUser.id !== dbUser.id) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = emailLower;
    }

    // Update password if provided
    if (newPassword && newPassword.trim()) {
      // Validate new password
      const trimmedNewPassword = newPassword.trim();
      if (trimmedNewPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Check if password_hash is a placeholder (OAuth user) or real password
      const isOAuthUser = dbUser.password_hash && dbUser.password_hash.includes('oauth_user_no_password_');
      
      // If user has real password_hash, require current password
      // If user has placeholder password_hash (OAuth user), allow setting password without current password
      if (!isOAuthUser && dbUser.password_hash) {
        // User has existing password - require current password
        if (!currentPassword || !currentPassword.trim()) {
          return res.status(400).json({ error: 'Current password is required to change password' });
        }

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword.trim(), dbUser.password_hash);
        if (!passwordMatch) {
          return res.status(401).json({ error: 'Invalid current password' });
        }
      }
      // Else: OAuth user - allow setting password without current password check

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(trimmedNewPassword, saltRounds);
      await db.updateUserPassword(dbUser.id, passwordHash);
    }

    // Update other fields
    if (Object.keys(updates).length > 0) {
      await db.updateUser(dbUser.id, updates);
    }

    // Get updated user
    const updatedUser = await db.getUserById(dbUser.id);

    return res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        email_verified: updatedUser.email_verified,
        created_at: updatedUser.created_at,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// Set custom domain
app.post('/domain/custom', async (req, res) => {
  try {
    const { shortCode, domain } = req.body;
    console.log('🔧 Set custom domain request:', { shortCode, domain, body: req.body });
    
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user) {
      console.log('❌ Unauthorized: No user found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('✅ User authenticated:', user.email);

    const urlRecord = await db.getUrlByShortCode(shortCode);
    if (!urlRecord) {
      console.log('❌ URL not found:', shortCode);
      return res.status(404).json({ error: 'URL not found' });
    }

    if (urlRecord.user_id !== user.id) {
      console.log('❌ Unauthorized: User does not own this URL');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Allow null to remove domain
    const domainValue = domain && domain.trim() ? domain.trim() : null;
    console.log('💾 Updating domain:', { shortCode, domain: domainValue, oldDomain: urlRecord.custom_domain });
    
    const updated = await db.updateUrlCustomDomain(shortCode, domainValue);
    console.log('✅ Domain updated successfully:', { shortCode, newDomain: updated?.custom_domain });

    return res.json({ success: true, customDomain: updated?.custom_domain });
  } catch (error) {
    console.error('❌ Set custom domain error:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ error: 'Failed to set custom domain', details: error.message });
  }
});

// Content Management endpoints
app.get('/admin/content', async (req, res) => {
  try {
    // Allow public read access to content (for frontend display)
    // Admin check only for write operations
    const content = await db.getAllContent();
    return res.json({ content });
  } catch (error) {
    console.error('Get content error:', error);
    return res.status(500).json({ error: 'Failed to get content' });
  }
});

app.post('/admin/content', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user || !(await db.isAdmin(user.id))) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    const { id, key, value, category, description } = req.body;

    if (!key || !value || !category) {
      return res.status(400).json({ error: 'key, value, and category are required' });
    }

    let result;
    if (id) {
      // Update existing
      result = await db.updateContent(id, key, value, category, description);
      if (!result) {
        return res.status(404).json({ error: 'Content not found' });
      }
    } else {
      // Create new
      result = await db.createContent(key, value, category, description);
    }

    return res.json({ content: result });
  } catch (error) {
    console.error('Save content error:', error);
    return res.status(500).json({ error: 'Failed to save content' });
  }
});

app.delete('/admin/content/:id', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user || !(await db.isAdmin(user.id))) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    const id = parseInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    const result = await db.deleteContent(id);
    if (!result) {
      return res.status(404).json({ error: 'Content not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete content error:', error);
    return res.status(500).json({ error: 'Failed to delete content' });
  }
});

// Admin: Get limit settings
app.get('/admin/limit-settings', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user || !(await db.isAdmin(user.id))) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    const settings = await db.getAllLimitSettings();
    const overrides = await db.getAllUserLimitOverrides();

    return res.json({
      success: true,
      settings,
      overrides,
    });
  } catch (error) {
    console.error('Get limit settings error:', error);
    return res.status(500).json({ error: 'Failed to get limit settings' });
  }
});

// Admin: Update limit setting
app.put('/admin/limit-settings/:key', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user || !(await db.isAdmin(user.id))) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const setting = await db.setLimitSetting(key, value.toString(), description);

    return res.json({
      success: true,
      setting,
    });
  } catch (error) {
    console.error('Update limit setting error:', error);
    return res.status(500).json({ error: 'Failed to update limit setting' });
  }
});

// Admin: Set user limit override
app.post('/admin/limit-override', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user || !(await db.isAdmin(user.id))) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    const { userId, fingerprint, limitEnabled, maxLinks, notes } = req.body;

    if (!userId && !fingerprint) {
      return res.status(400).json({ error: 'Either userId or fingerprint is required' });
    }

    if (limitEnabled === undefined) {
      return res.status(400).json({ error: 'limitEnabled is required' });
    }

    if (maxLinks === undefined) {
      return res.status(400).json({ error: 'maxLinks is required' });
    }

    const override = await db.setUserLimitOverride(userId || null, fingerprint || null, limitEnabled, maxLinks, notes);

    return res.json({
      success: true,
      override,
    });
  } catch (error) {
    console.error('Set user limit override error:', error);
    return res.status(500).json({ error: 'Failed to set user limit override' });
  }
});

// Admin: Delete user limit override
app.delete('/admin/limit-override', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user || !(await db.isAdmin(user.id))) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    const { userId, fingerprint } = req.query;

    if (!userId && !fingerprint) {
      return res.status(400).json({ error: 'Either userId or fingerprint is required' });
    }

    const deleted = await db.deleteUserLimitOverride(userId || null, fingerprint || null);

    if (!deleted) {
      return res.status(404).json({ error: 'Override not found' });
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete user limit override error:', error);
    return res.status(500).json({ error: 'Failed to delete user limit override' });
  }
});

// Forgot password - request password reset
console.log('🔍 [INIT] Registering /forgot-password endpoint...');
app.post('/forgot-password', async (req, res) => {
  console.log('✅ [ROUTE] /forgot-password endpoint REGISTERED and CALLED');
  console.log('🔍 [DEBUG] /forgot-password endpoint called', { method: req.method, path: req.path, hasBody: !!req.body });
  console.log('🔍 [DEBUG] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 [DEBUG] Request body:', JSON.stringify(req.body, null, 2));
  // #region agent log
  import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1428',message:'/forgot-password endpoint called',data:{method:req.method,path:req.path,hasBody:!!req.body,hasEmail:!!req.body?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})+'\n').catch(()=>{})).catch(()=>{});
  // #endregion
  try {
    const { email } = req.body;
    // #region agent log
    import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1428',message:'Email extracted from request',data:{email:email,hasEmail:!!email},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})+'\n').catch(()=>{})).catch(()=>{});
    // #endregion
    
    // Always return success to prevent email enumeration
    // Don't reveal whether email exists or not
    if (!email || !email.trim()) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    const user = await db.getUserByEmail(email.trim().toLowerCase());
    
    if (user) {
      // Generate token
      const token = emailService.generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
      
      // Store token in database
      try {
        console.log('🔍 [DEBUG] Creating password reset token for user:', user.id);
        await db.createEmailToken(user.id, token, 'password_reset', expiresAt);
        console.log('🔍 [DEBUG] Token created successfully');
        
        // Send email
        try {
          await emailService.sendPasswordResetEmail(user.email, user.name, token);
          console.log('✅ Password reset email sent to:', user.email);
        } catch (emailError) {
          console.error('❌ Failed to send password reset email:', emailError);
          // Don't fail the request - still return success for security
        }
      } catch (tokenError) {
        console.error('❌ Failed to create password reset token:', tokenError);
        console.error('❌ Token error details:', { 
          message: tokenError.message, 
          code: tokenError.code, 
          name: tokenError.name 
        });
        // #region agent log
        import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1467',message:'Failed to create token',data:{error:tokenError.message,code:tokenError.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'D'})+'\n').catch(()=>{})).catch(()=>{});
        // #endregion
        // If table doesn't exist, log helpful message but still return success
        if (tokenError.message && tokenError.message.includes('migration')) {
          console.error('⚠️  Please run database migration: psql -U urlshortener -d urlshortener -f server/migrations/add_email_tokens.sql');
        }
        if (tokenError.code === '42P01') {
          console.error('⚠️  Table email_tokens does not exist. Please run migration.');
        }
        // Don't fail the request - still return success for security
      }
    }
    
    // Always return the same response
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Still return success to prevent information leakage
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  }
});

// Reset password - actually reset password with token
console.log('🔍 [INIT] Registering /reset-password endpoint...');
app.post('/reset-password', async (req, res) => {
  console.log('✅ [ROUTE] /reset-password endpoint REGISTERED and CALLED');
  const logData = { method: req.method, path: req.path, hasBody: !!req.body, bodyKeys: req.body ? Object.keys(req.body) : [], bodyType: typeof req.body };
  console.log('🔍 [DEBUG] /reset-password endpoint called', JSON.stringify(logData, null, 2));
  console.log('🔍 [DEBUG] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 [DEBUG] Request body:', JSON.stringify(req.body, null, 2));
  // #region agent log
  const logEntry = {location:'server/index.js:1517',message:'/reset-password endpoint called',data:logData,timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'A'};
  console.log('📝 [LOG]', JSON.stringify(logEntry));
  try {
    const fs = await import('fs');
    const path = await import('path');
    const logPath = '/home/ci97979/www/CuttoTech/.cursor/debug.log';
    const logDir = path.dirname(logPath);
    await fs.promises.mkdir(logDir, { recursive: true });
    await fs.promises.appendFile(logPath, JSON.stringify(logEntry)+'\n');
  } catch (logErr) {
    console.error('❌ Failed to write log file:', logErr.message);
  }
  // #endregion
  try {
    const { token, newPassword } = req.body || {};
    const bodyData = { hasToken: !!token, tokenLength: token?.length, hasNewPassword: !!newPassword, newPasswordLength: newPassword?.length };
    console.log('🔍 [DEBUG] Request body parsed', bodyData);
    // #region agent log
    try {
      const fs = await import('fs');
      const path = await import('path');
      const logDir = path.dirname('/home/ci97979/www/CuttoTech/.cursor/debug.log');
      await fs.promises.mkdir(logDir, { recursive: true });
      await fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log', JSON.stringify({location:'server/index.js:1523',message:'Request body parsed',data:bodyData,timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'A'})+'\n');
    } catch (logErr) {
      console.error('Failed to write log:', logErr);
    }
    // #endregion
    
    if (!token || !newPassword) {
      console.log('🔍 [DEBUG] Validation failed: missing token or password');
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      console.log('🔍 [DEBUG] Validation failed: password too short');
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Get token from database
    let tokenRecord;
    try {
      console.log('🔍 [DEBUG] Attempting to get token from database...');
      tokenRecord = await db.getEmailToken(token, 'password_reset');
      console.log('🔍 [DEBUG] Token lookup result:', { found: !!tokenRecord, tokenLength: token?.length });
    } catch (dbError) {
      console.error('❌ Database error getting token:', dbError);
      console.error('❌ Error details:', { 
        message: dbError.message, 
        code: dbError.code, 
        name: dbError.name,
        stack: dbError.stack 
      });
      // #region agent log
      import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1506',message:'Database error getting token',data:{error:dbError.message,code:dbError.code,name:dbError.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'D'})+'\n').catch(()=>{})).catch(()=>{});
      // #endregion
      if (dbError.message && dbError.message.includes('migration')) {
        return res.status(500).json({ 
          error: 'Database configuration error. Please contact administrator.',
          details: 'Email tokens table not found. Migration required.'
        });
      }
      // If it's a table doesn't exist error, return helpful message
      if (dbError.code === '42P01') {
        return res.status(500).json({ 
          error: 'Database configuration error. Please contact administrator.',
          details: 'Email tokens table not found. Please run: psql -U urlshortener -d urlshortener -f server/migrations/add_email_tokens.sql'
        });
      }
      throw dbError;
    }
    // #region agent log
    import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1491',message:'Token lookup result',data:{found:!!tokenRecord,expired:tokenRecord?new Date(tokenRecord.expires_at)<new Date():false,used:tokenRecord?.used},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n').catch(()=>{})).catch(()=>{});
    // #endregion
    
    if (!tokenRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Mark token as used
    await db.markEmailTokenAsUsed(token);
    
    // Update password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await db.updateUserPassword(tokenRecord.user_id, passwordHash);
    
    console.log('✅ Password reset successful for user:', tokenRecord.user_id);
    // #region agent log
    import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1428',message:'Password reset successful',data:{userId:tokenRecord.user_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n').catch(()=>{})).catch(()=>{});
    // #endregion
    
    return res.json({
      success: true,
      message: 'Password has been reset successfully.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    // #region agent log
    import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1433',message:'Reset password error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n').catch(()=>{})).catch(()=>{});
    // #endregion
    return res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

// Verify email - verify email address with token
console.log('🔍 [INIT] Registering /verify-email endpoint...');
app.get('/verify-email', async (req, res) => {
  console.log('✅ [ROUTE] /verify-email endpoint REGISTERED and CALLED');
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Get token from database
    let tokenRecord;
    try {
      tokenRecord = await db.getEmailToken(token, 'email_verification');
    } catch (dbError) {
      console.error('❌ Database error getting verification token:', dbError);
      if (dbError.message && dbError.message.includes('migration')) {
        return res.status(500).json({ 
          error: 'Database configuration error. Please contact administrator.',
          details: 'Email tokens table not found. Migration required.'
        });
      }
      throw dbError;
    }
    
    if (!tokenRecord) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Mark token as used
    try {
      await db.markEmailTokenAsUsed(token);
    } catch (markError) {
      console.error('❌ Error marking token as used:', markError);
      // Continue anyway - token lookup already validated it
    }
    
    // Update user email_verified status
    await db.updateUser(tokenRecord.user_id, { email_verified: true });
    
    console.log('✅ Email verified for user:', tokenRecord.user_id);
    
    // Redirect to frontend with success message
    const frontendUrl = new URL('/', BASE_URL);
    frontendUrl.searchParams.set('verified', 'true');
    return res.redirect(frontendUrl.toString());
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Failed to verify email', details: error.message });
  }
});

// Debug: Verify endpoints are registered immediately after definition
console.log('🔍 [INIT] Checking email endpoints registration...');
const checkRoutes = () => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase()).join(', ');
      routes.push(`${methods} ${middleware.route.path}`);
    }
  });
  const hasForgotPassword = routes.some(r => r.includes('/forgot-password'));
  const hasResetPassword = routes.some(r => r.includes('/reset-password'));
  const hasVerifyEmail = routes.some(r => r.includes('/verify-email'));
  console.log(`🔍 [INIT] Email endpoints check: forgot-password=${hasForgotPassword ? '✅' : '❌'}, reset-password=${hasResetPassword ? '✅' : '❌'}, verify-email=${hasVerifyEmail ? '✅' : '❌'}`);
  if (!hasForgotPassword || !hasResetPassword || !hasVerifyEmail) {
    console.error('❌ [INIT] CRITICAL: Some email endpoints are NOT registered!');
  }
};
// Check immediately (may not work if routes not yet registered)
setTimeout(checkRoutes, 100);

// Admin: Add admin by email (works with local database)
app.post('/admin/add-by-email', async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const user = await getUserFromToken(accessToken);

    if (!user || !(await db.isAdmin(user.id))) {
      return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user in local database
    let targetUser = await db.getUserByEmail(email);

    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: `No user found with email: ${email}. Please register first.`,
      });
    }

    // Add admin flag to local database
    await db.setAdmin(targetUser.id, true);

    console.log(`✅ Admin access granted to ${email} (user ID: ${targetUser.id})`);

    return res.json({
      success: true,
      message: `Admin access granted to ${email}`,
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    console.error('Add admin error:', error);
    return res.status(500).json({ error: 'Failed to add admin', details: error.message });
  }
});

// ==================== EXPLICIT SPA ROUTES (High Priority) ====================
// Handle these BEFORE the wildcard /:code handler takes over.
// This prevents /admin, /dashboard, etc. from being treated as short codes.
// Using Express array syntax to handle all SPA paths in one go.
// These routes handle both with and without trailing slashes.
const spaPaths = ['/admin', '/dashboard', '/settings', '/privacy', '/terms', '/login'];

// Handler function for SPA routes
const handleSpaRoute = (req, res) => {
  // Debug logging for file paths
  console.log('🔍 SPA Debug - Requested:', req.path);
  console.log('📂 Configured distPath:', distPath);
  const debugIndexPath = path.join(distPath, 'index.html');
  console.log('📄 Looking for index.html at:', debugIndexPath);
  console.log('❓ File exists?:', fs.existsSync(debugIndexPath));
  
  // Handle trailing slashes by normalizing the path
  const normalizedPath = req.path.replace(/\/$/, '');
  
  // Verify it's still a valid SPA route (security check)
  if (!spaPaths.includes(normalizedPath)) {
    return res.status(404).json({ error: 'Route not found' });
  }
  
  if (distExists) {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    } else {
      return res.status(404).json({ error: 'Frontend not built. Please run "npm run build" or use Vite dev server.' });
    }
  } else {
    return res.status(503).json({ 
      error: 'Frontend not available in development mode',
      message: 'Please access the frontend through Vite dev server at http://localhost:3001',
      devServer: 'http://localhost:3001'
    });
  }
};

// Register SPA routes without trailing slash
app.get(spaPaths, handleSpaRoute);

// Register SPA routes with trailing slash (Express array syntax)
app.get(spaPaths.map(p => p + '/'), handleSpaRoute);

// Direct redirect handler for short codes (HTTP 302)
// This MUST come AFTER all API routes and SPA routes but BEFORE static files and SPA fallback
// IMPORTANT: Express matches routes in order, so SPA routes are already handled above
// CRITICAL: This route MUST NOT intercept API routes like /admin/stats or SPA routes like /admin
app.get('/:code', async (req, res, next) => {
  const shortCode = req.params.code;
  const fullPath = req.path;
  
  // CRITICAL: Skip ALL API routes - check full path
  // List of all API route prefixes - must match exactly what's defined above
  // NOTE: /admin is NOT in this list because /admin alone is a SPA route
  // Only /admin/* sub-paths are API routes (e.g., /admin/stats, /admin/urls)
  const apiRoutes = [
    '/health',
    '/signup',
    '/shorten',
    '/user',
    '/stats',
    '/redirect',
    '/domain',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/auth',
    '/debug',
    '/test-endpoint',
  ];
  
  // CRITICAL: Check if this is an API route
  // API routes can be exact matches or have sub-paths
  // Special handling for /admin/* - only sub-paths are API routes, not /admin itself
  let isApiRoute = false;
  
  // Check standard API routes
  isApiRoute = apiRoutes.some(route => {
    // Exact match
    if (fullPath === route) return true;
    // Starts with route + / (e.g., /user/profile starts with /user/)
    if (fullPath.startsWith(route + '/')) return true;
    return false;
  });
  
  // Special case: /admin/* sub-paths are API routes (but /admin alone is SPA)
  if (!isApiRoute && fullPath.startsWith('/admin/')) {
    isApiRoute = true;
  }
  
  // CRITICAL: If this is an API route, skip immediately and pass to API handlers
  if (isApiRoute) {
    console.log(`✅ /:code handler skipping API route: ${fullPath}`);
    return next(); // Pass to API route handlers
  }
  
  // Also check for multiple path segments (API routes have /path/segment format)
  const pathSegments = fullPath.split('/').filter(Boolean);
  const hasMultipleSegments = pathSegments.length > 1;
  
  // Debug logging for troubleshooting
  if (fullPath === '/health' || fullPath === '/shorten' || fullPath.startsWith('/admin') || fullPath === '/privacy' || fullPath === '/terms' || fullPath === '/dashboard' || fullPath === '/settings') {
    console.log(`🔍 /:code handler intercepted ${fullPath}, isApiRoute: ${isApiRoute}, segments: ${pathSegments.length}`);
  }
  
  // Skip if it has multiple segments (likely an API route or file path) or looks like a file
  if (hasMultipleSegments ||
      shortCode.includes('.') || // Files with extensions
      shortCode.length > 20) { // Short codes are max 20 characters (custom codes can be longer)
    // #region agent log
    if (fullPath.startsWith('/admin')) {
      fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:1952',message:'/:code calling next() for admin route',data:{fullPath,isApiRoute,hasMultipleSegments},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    }
    // #endregion
    return next(); // Skip to next handler (should be API route or static files)
  }

  try {
    const urlRecord = await db.getUrlByShortCode(shortCode);

    if (!urlRecord) {
      // Not a short code, continue to SPA
      return next();
    }

    // NOTE: This processClick() handles backend monetization (WAP offers for Nigeria/Pakistan)
    // Process monetization logic (determine if offer should be shown)
    const { redirectUrl } = await processClick(urlRecord, req);

    // Get IP and location info for statistics
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
               req.headers['x-real-ip'] || 
               req.ip || 
               'unknown';
    // #region agent log
    import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1497',message:'IP extracted',data:{ip:ip,isNull:ip===null,isUndefined:ip===undefined,type:typeof ip},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n').catch(()=>{})).catch(()=>{});
    // #endregion
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Check if admin stealth mode is enabled
    // Only skip stats if: user is admin AND stealth mode cookie is 'true'
    let shouldSkipStats = false;
    try {
      const accessToken = req.headers.authorization?.split(' ')[1] || 
                         req.cookies?.access_token || 
                         req.cookies?.token;
      if (accessToken) {
        const user = await getUserFromToken(accessToken);
        if (user) {
          const isAdmin = await db.isAdmin(user.id);
          const stealthMode = req.cookies?.admin_stealth_mode === 'true';
          if (isAdmin && stealthMode) {
            shouldSkipStats = true;
            console.log('👻 Stealth Mode: Skipping stat recording for admin user');
          }
        }
      }
    } catch (adminCheckError) {
      // If admin check fails, continue with normal stat recording
      console.log('Admin check failed, recording stats normally:', adminCheckError.message);
    }

    // Store statistics asynchronously (don't wait for geolocation)
    // Skip if admin stealth mode is enabled
    if (shouldSkipStats) {
      console.log('👻 Stealth Mode: Admin click detected, skipping stat recording');
    } else {
      (async () => {
        // #region agent log
        import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1505',message:'Async stat save started',data:{urlId:urlRecord.id,shortCode:urlRecord.short_code,ip:ip},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n').catch(()=>{})).catch(()=>{});
        // #endregion
        try {
        let country = 'Unknown';
        let city = 'Unknown';
        
        if (ip !== 'unknown' && !ip.startsWith('127.') && !ip.startsWith('::1') && !ip.startsWith('192.168.') && !ip.startsWith('10.') && !ip.startsWith('172.')) {
          try {
            const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
              headers: {
                'User-Agent': 'Mozilla/5.0'
              }
            });
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              if (geoData.error) {
                console.error('ipapi.co error for IP', ip, ':', geoData.reason || geoData.error);
                // Try alternative API as fallback
                try {
                  const altResponse = await fetch(`https://ip-api.com/json/${ip}?fields=status,message,country,city`);
                  if (altResponse.ok) {
                    const altData = await altResponse.json();
                    if (altData.status === 'success') {
                      country = altData.country || 'Unknown';
                      city = altData.city || 'Unknown';
                    }
                  }
                } catch (altError) {
                  // Ignore fallback errors
                }
              } else {
                country = geoData.country_name || geoData.country || 'Unknown';
                city = geoData.city || 'Unknown';
              }
            } else {
              console.error('ipapi.co HTTP error for IP', ip, ':', geoResponse.status);
            }
          } catch (geoError) {
            console.error('Geolocation error for IP', ip, ':', geoError);
          }
        } else {
          console.log('Skipping geolocation for local IP:', ip);
        }
        
        // Detect device type
        const device = detectDevice(userAgent);
        if (!device || device === 'Unknown') {
          console.log('⚠️ Device detection failed for user agent:', userAgent);
        }
        
        // Debug logging
        console.log('📊 Storing stat (async):', { 
          urlId: urlRecord.id, 
          shortCode: urlRecord.short_code,
          ip, 
          country, 
          city, 
          device, 
          userAgent: userAgent.substring(0, 50) 
        });
        
        // Store statistics (device instead of full user agent)
        // #region agent log
        import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1566',message:'Before createStat call',data:{urlId:urlRecord.id,ip:ip,country:country,city:city,device:device},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n').catch(()=>{})).catch(()=>{});
        // #endregion
        const statResult = await db.createStat(
          urlRecord.id,
          ip,
          country,
          city,
          device
        );
        
        console.log('✅ Stat stored (async):', { 
          id: statResult.id, 
          urlId: statResult.url_id,
          country: statResult.country, 
          user_agent: statResult.user_agent,
          city: statResult.city 
        });
        // #region agent log
        import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1574',message:'Stat stored successfully',data:{statId:statResult.id,urlId:statResult.url_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n').catch(()=>{})).catch(()=>{});
        // #endregion
      } catch (statError) {
        console.error('❌ Failed to store stats:', statError);
        console.error('❌ Stat error details:', {
          message: statError.message,
          stack: statError.stack,
          urlId: urlRecord?.id,
          shortCode: urlRecord?.short_code
        });
        // #region agent log
        import('fs').then(fs=>fs.promises.appendFile('/home/ci97979/www/CuttoTech/.cursor/debug.log',JSON.stringify({location:'server/index.js:1581',message:'Stat save error caught',data:{errorMessage:statError.message,urlId:urlRecord?.id,shortCode:urlRecord?.short_code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n').catch(()=>{})).catch(()=>{});
        // #endregion
      }
    })();
    }

    // Immediate HTTP 302 redirect (don't wait for stats)
    // Use redirectUrl from monetization service (may be offer URL or original URL)
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    // On error, continue to SPA (don't break the site)
    return next();
  }
});

// Serve static files from dist folder (frontend) - ONLY if dist folder exists (production mode)
// In development, frontend is served by Vite dev server on port 3001
// NOTE: Static files middleware is registered AFTER all API routes to ensure API routes are handled first
if (distExists) {
  // Configure static middleware to skip API routes
  // CRITICAL: Static middleware must be registered AFTER all API routes
  // IMPORTANT: Only serve static files for specific non-API paths
  
  // Serve assets (CSS, JS, images) from /assets path - this is safe as it's a specific path
  app.use('/assets', express.static(path.join(distPath, 'assets')));
  
  // Serve other static files (favicon, etc.) but ONLY for non-API routes
  // CRITICAL: This middleware must check API routes BEFORE calling express.static
  // Use a wrapper to prevent express.static from processing API routes
  app.use((req, res, next) => {
    // CRITICAL: Skip ALL API routes FIRST - they must be handled by API route handlers above
    // This check must happen BEFORE any static file serving
    // NOTE: /admin alone is a SPA route, not an API route. Only /admin/* sub-paths are API routes.
    const apiRoutes = ['/health', '/signup', '/login', '/shorten', '/user', '/stats', '/redirect', '/domain', '/forgot-password', '/reset-password', '/verify-email', '/auth', '/debug', '/test-endpoint'];
    let isApiRoute = apiRoutes.some(route => req.path.startsWith(route));
    
    // Special handling: /admin/* sub-paths are API routes (but /admin alone is SPA)
    if (!isApiRoute && req.path.startsWith('/admin/')) {
      isApiRoute = true;
    }
    
    // Special logging for /admin/stats to debug routing issues
    if (req.path === '/admin/stats') {
      console.log('🔍 [STATIC MIDDLEWARE] /admin/stats detected, skipping static file serving');
    }
    
    if (isApiRoute) {
      // CRITICAL: Skip static file serving for API routes immediately
      // API routes should NEVER be processed by static middleware
      // Call next() to pass to API route handlers
      return next();
    }
    
    // For non-API routes only, try to serve static files (favicon, etc.)
    // But don't serve index.html here - that's handled by catch-all route below
    // Create static handler with fallthrough to prevent it from sending responses for API routes
    const staticHandler = express.static(distPath, { 
      index: false, // Don't serve index.html automatically
      fallthrough: true // Pass to next middleware if file not found
    });
    
    // Wrap static handler to ensure it doesn't interfere with API routes
    // Override res.sendFile to prevent it from being called for API routes
    const originalSendFile = res.sendFile;
    res.sendFile = function(filePath, options, callback) {
      // Double check - if this is an API route, don't send file
      // NOTE: /admin alone is a SPA route, not an API route. Only /admin/* sub-paths are API routes.
      const apiRoutes = ['/health', '/signup', '/login', '/shorten', '/user', '/stats', '/redirect', '/domain', '/forgot-password', '/reset-password', '/verify-email', '/auth', '/debug', '/test-endpoint'];
      let isApiRoute = apiRoutes.some(route => req.path.startsWith(route));
      // Special handling: /admin/* sub-paths are API routes (but /admin alone is SPA)
      if (!isApiRoute && req.path.startsWith('/admin/')) {
        isApiRoute = true;
      }
      if (isApiRoute) {
        res.sendFile = originalSendFile; // Restore
        return next(); // Skip file serving
      }
      res.sendFile = originalSendFile; // Restore
      return originalSendFile.call(this, filePath, options, callback);
    };
    
    // Call static handler only for non-API routes
    staticHandler(req, res, (err) => {
      res.sendFile = originalSendFile; // Restore
      if (err) {
        return next(err);
      }
      // If static handler didn't send a response, continue to next middleware
      if (!res.headersSent) {
        return next();
      }
    });
  });
  
  // SPA fallback: serve index.html for all non-API routes (but not short codes - they're handled above)
  // IMPORTANT: This must come AFTER static middleware, and must check API routes
  // CRITICAL: This catch-all route must NOT interfere with API routes
  app.get('*', (req, res, next) => {
    // CRITICAL: Skip ALL API routes - they must be handled by API route handlers above
    // Note: /admin is a SPA route, not an API route. API routes are /admin/stats, /admin/limit-settings, etc.
    const apiRoutes = ['/health', '/signup', '/login', '/shorten', '/user', '/stats', '/redirect', '/domain', '/forgot-password', '/reset-password', '/verify-email', '/auth', '/debug', '/test-endpoint'];
    let isApiRoute = apiRoutes.some(route => req.path.startsWith(route));
    
    // Special handling: /admin/* sub-paths are API routes (but /admin alone is SPA)
    if (!isApiRoute && req.path.startsWith('/admin/')) {
      isApiRoute = true;
    }
    
    // Special logging for /admin/stats to debug routing issues
    if (req.path === '/admin/stats') {
      console.error('🚨 [CRITICAL ERROR] Catch-all route intercepted /admin/stats! This should NEVER happen!');
      console.error('🚨 [CRITICAL ERROR] Route details:', {
        path: req.path,
        url: req.url,
        method: req.method,
        isApiRoute,
        headersSent: res.headersSent
      });
      // Don't serve HTML for API routes - return 404 JSON instead
      if (!res.headersSent) {
        return res.status(404).json({ error: 'API endpoint not found - route was intercepted by catch-all' });
      }
      return;
    }
    
    if (isApiRoute) {
      // This should never happen if API routes are registered correctly
      console.error('⚠️ [WARNING] Catch-all route reached for API route:', req.path);
      if (!res.headersSent) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      return;
    }
    
    // Only serve index.html for non-API routes
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend not built. Please run "npm run build" or use Vite dev server.' });
    }
  });
} else {
  // #region agent log
  fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:2100',message:'Development mode fallback registered',data:{distExists:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  // Development mode: return helpful error for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes - they're handled above
    // NOTE: /admin alone is a SPA route, not an API route. Only /admin/* sub-paths are API routes.
    const apiRoutes = ['/health', '/signup', '/login', '/shorten', '/user', '/stats', '/redirect', '/domain', '/forgot-password', '/reset-password', '/verify-email', '/auth', '/debug', '/test-endpoint'];
    let isApiRoute = apiRoutes.some(route => req.path.startsWith(route));
    
    // Special handling: /admin/* sub-paths are API routes (but /admin alone is SPA)
    if (!isApiRoute && req.path.startsWith('/admin/')) {
      isApiRoute = true;
    }
    
    // #region agent log
    if (req.path.startsWith('/admin')) {
      fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:2102',message:'Dev fallback checking admin route',data:{path:req.path,isApiRoute},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    }
    // #endregion
    
    if (isApiRoute) {
      // Let API routes pass through to their handlers
      // #region agent log
      if (req.path.startsWith('/admin')) {
        fetch('http://localhost:7243/ingest/e500f8af-8b0f-455e-976a-e3d5bf92d273',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server/index.js:2107',message:'Dev fallback calling next() for admin',data:{path:req.path},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      }
      // #endregion
      next();
    } else {
      res.status(503).json({ 
        error: 'Frontend not available in development mode',
        message: 'Please access the frontend through Vite dev server at http://localhost:3001',
        devServer: 'http://localhost:3001'
      });
    }
  });
}

// Start server
// Listen on localhost only - server should be accessed only through Nginx reverse proxy (domain)
app.listen(PORT, '127.0.0.1', () => {
  const databaseUrl = process.env.DATABASE_URL?.split('@')[1] || 'localhost:5432/urlshortener';
  
  // Structured logging for server start
  logger.info({
    event: 'server_start',
    port: PORT,
    host: '127.0.0.1',
    baseUrl: BASE_URL,
    database: databaseUrl,
    auth: 'Local JWT',
    nodeEnv: process.env.NODE_ENV || 'development',
  });
  
  // Debug: List all registered routes (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase()).join(', ');
        routes.push(`${methods} ${middleware.route.path}`);
      }
    });
    
    logger.debug({
      event: 'routes_registered',
      totalRoutes: routes.length,
      routes: routes,
    });
    
    // Check if our endpoints are registered
    const hasForgotPassword = routes.some(r => r.includes('/forgot-password'));
    const hasResetPassword = routes.some(r => r.includes('/reset-password'));
    const hasVerifyEmail = routes.some(r => r.includes('/verify-email'));
    
    logger.debug({
      event: 'email_endpoints_check',
      forgotPassword: hasForgotPassword,
      resetPassword: hasResetPassword,
      verifyEmail: hasVerifyEmail,
    });
    
    // Check if endpoints are registered (development only)
    if (!hasForgotPassword || !hasResetPassword || !hasVerifyEmail) {
      logger.warn({
        event: 'email_endpoints_missing',
        message: 'Email endpoints are NOT registered',
      });
    } else {
      logger.debug({
        event: 'email_endpoints_ok',
        message: 'All email endpoints are registered successfully',
      });
    }
  }
});

