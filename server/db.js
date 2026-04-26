// Database connection and queries
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

// SSL is required by managed Postgres providers (Saturn, Railway, Heroku, Neon, etc.)
// Auto-enable when DATABASE_URL points to a remote host (not localhost).
const databaseUrl = process.env.DATABASE_URL || 'postgresql://urlshortener:urlshortener_secure_password_2024@localhost:5432/urlshortener';
const isLocalDb = /(@|\/)(localhost|127\.0\.0\.1|::1)(:|\/)/.test(databaseUrl);
const useSsl = process.env.PGSSL === 'true' || (!isLocalDb && process.env.PGSSL !== 'false');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

export default pool;

// Helper functions for database operations

// URLs
export async function getUrlByShortCode(shortCode) {
  const result = await pool.query(
    'SELECT * FROM urls WHERE short_code = $1',
    [shortCode]
  );
  return result.rows[0] || null;
}

export async function createUrl(
  shortCode, 
  originalUrl, 
  userId = null, 
  customDomain = null, 
  creatorIp = null, 
  creatorToken = null,
  utmSource = null,
  utmMedium = null,
  utmCampaign = null,
  utmContent = null,
  utmTerm = null,
  gclid = null,
  referrer = null
) {
  const result = await pool.query(
    `INSERT INTO urls (
      short_code, original_url, user_id, custom_domain, creator_ip, creator_token,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, referrer
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      shortCode, originalUrl, userId, customDomain, creatorIp, creatorToken,
      utmSource, utmMedium, utmCampaign, utmContent, utmTerm, gclid, referrer
    ]
  );
  return result.rows[0];
}

/**
 * Create URL for anonymous user with limit enforcement in a single DB transaction.
 * This prevents bypass via missing fingerprint and mitigates race conditions from parallel requests.
 *
 * Note: `anonKey` is stored in `anonymous_limits.fingerprint` column for backwards compatibility.
 */
export async function createUrlWithAnonymousLimit({
  anonKey,
  maxLinks,
  shortCode,
  originalUrl,
  userId = null,
  customDomain = null,
  creatorIp = null,
  creatorToken = null,
  utmSource = null,
  utmMedium = null,
  utmCampaign = null,
  utmContent = null,
  utmTerm = null,
  gclid = null,
  referrer = null,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock (or create) the anonymous_limits row for this anonKey to make check+increment atomic
    const existing = await client.query(
      'SELECT count FROM anonymous_limits WHERE fingerprint = $1 FOR UPDATE',
      [anonKey]
    );

    const currentCount = existing.rows[0]?.count ?? 0;
    if (currentCount >= maxLinks) {
      await client.query('ROLLBACK');
      const err = new Error('limit_reached');
      err.code = 'LIMIT_REACHED';
      err.currentCount = currentCount;
      throw err;
    }

    if (existing.rowCount === 0) {
      await client.query(
        'INSERT INTO anonymous_limits (fingerprint, count) VALUES ($1, 1)',
        [anonKey]
      );
    } else {
      await client.query(
        'UPDATE anonymous_limits SET count = count + 1, updated_at = NOW() WHERE fingerprint = $1',
        [anonKey]
      );
    }

    const urlResult = await client.query(
      `INSERT INTO urls (
        short_code, original_url, user_id, custom_domain, creator_ip, creator_token,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, referrer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        shortCode, originalUrl, userId, customDomain, creatorIp, creatorToken,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm, gclid, referrer
      ]
    );

    await client.query('COMMIT');
    return urlResult.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteUrl(shortCode) {
  const result = await pool.query(
    'DELETE FROM urls WHERE short_code = $1 RETURNING *',
    [shortCode]
  );
  return result.rows[0] || null;
}

export async function getUserUrls(userId) {
  const result = await pool.query(
    'SELECT * FROM urls WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

export async function getAllUrls() {
  const result = await pool.query(
    'SELECT * FROM urls ORDER BY created_at DESC'
  );
  return result.rows;
}

// Get URLs filtered by user type
// userId: specific user ID to filter by (if provided)
// registeredOnly: true = only registered users (user_id IS NOT NULL)
// registeredOnly: false = only anonymous users (user_id IS NULL)
// registeredOnly: null = all URLs (or specific userId if provided)
export async function getUrlsByUserId(userId, registeredOnly = null) {
  let query;
  let params;
  
  if (userId) {
    // Filter by specific user ID
    query = 'SELECT * FROM urls WHERE user_id = $1 ORDER BY created_at DESC';
    params = [userId];
  } else if (registeredOnly === true) {
    // Only registered users
    query = 'SELECT * FROM urls WHERE user_id IS NOT NULL ORDER BY created_at DESC';
    params = [];
  } else if (registeredOnly === false) {
    // Only anonymous users
    query = 'SELECT * FROM urls WHERE user_id IS NULL ORDER BY created_at DESC';
    params = [];
  } else {
    // All URLs
    query = 'SELECT * FROM urls ORDER BY created_at DESC';
    params = [];
  }
  
  const result = await pool.query(query, params);
  return result.rows;
}

// Get count of anonymous links by creator_token
export async function getAnonymousLinkCount(creatorToken) {
  if (!creatorToken) {
    return 0;
  }
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM urls WHERE creator_token = $1 AND user_id IS NULL',
    [creatorToken]
  );
  return parseInt(result.rows[0]?.count || 0, 10);
}

// Get URLs by specific client UUID (creator_token)
export async function getUrlsByClientUuid(clientUuid) {
  const result = await pool.query(
    'SELECT * FROM urls WHERE creator_token = $1 AND user_id IS NULL ORDER BY created_at DESC',
    [clientUuid]
  );
  return result.rows;
}

export async function updateUrlCustomDomain(shortCode, domain) {
  const result = await pool.query(
    'UPDATE urls SET custom_domain = $1 WHERE short_code = $2 RETURNING *',
    [domain, shortCode]
  );
  return result.rows[0] || null;
}

// Statistics
export async function createStat(urlId, ipAddress, country, city, userAgent) {
  try {
    console.log('📊 Creating stat record:', { urlId, ipAddress, country, city, userAgent });
    const result = await pool.query(
      'INSERT INTO stats (url_id, ip_address, country, city, user_agent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [urlId, ipAddress, country, city, userAgent]
    );
    console.log('✅ Stat record created:', { id: result.rows[0]?.id, urlId: result.rows[0]?.url_id });
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error creating stat record:', error);
    console.error('❌ Stat creation error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      urlId,
      ipAddress,
      country,
      city
    });
    throw error; // Re-throw to let caller handle it
  }
}

export async function getStatsByUrlId(urlId) {
  const result = await pool.query(
    'SELECT * FROM stats WHERE url_id = $1 ORDER BY created_at DESC',
    [urlId]
  );
  return result.rows;
}

export async function getStatsByShortCode(shortCode) {
  const result = await pool.query(
    `SELECT s.* FROM stats s 
     JOIN urls u ON s.url_id = u.id 
     WHERE u.short_code = $1 
     ORDER BY s.created_at DESC`,
    [shortCode]
  );
  return result.rows;
}

// Admin flags
export async function isAdmin(userId) {
  try {
    if (!userId) {
      return false;
    }
    const result = await pool.query(
      'SELECT is_admin FROM admin_flags WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.is_admin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false; // Fail safe: if error, user is not admin
  }
}

export async function setAdmin(userId, isAdmin) {
  const result = await pool.query(
    `INSERT INTO admin_flags (user_id, is_admin) 
     VALUES ($1, $2) 
     ON CONFLICT (user_id) 
     DO UPDATE SET is_admin = $2, updated_at = NOW() 
     RETURNING *`,
    [userId, isAdmin]
  );
  return result.rows[0];
}

// Anonymous limits
export async function getAnonymousCount(fingerprint) {
  const result = await pool.query(
    'SELECT count FROM anonymous_limits WHERE fingerprint = $1',
    [fingerprint]
  );
  return result.rows[0]?.count || 0;
}

export async function incrementAnonymousCount(fingerprint) {
  const result = await pool.query(
    `INSERT INTO anonymous_limits (fingerprint, count) 
     VALUES ($1, 1) 
     ON CONFLICT (fingerprint) 
     DO UPDATE SET count = anonymous_limits.count + 1, updated_at = NOW() 
     RETURNING *`,
    [fingerprint]
  );
  return result.rows[0];
}

// Content (CMS)
export async function getAllContent() {
  const result = await pool.query(
    'SELECT * FROM content ORDER BY category, key'
  );
  return result.rows;
}

export async function getContentById(id) {
  const result = await pool.query(
    'SELECT * FROM content WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function createContent(key, value, category, description = null) {
  const result = await pool.query(
    `INSERT INTO content (key, value, category, description) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [key, value, category, description]
  );
  return result.rows[0];
}

export async function updateContent(id, key, value, category, description = null) {
  const result = await pool.query(
    `UPDATE content 
     SET key = $1, value = $2, category = $3, description = $4, updated_at = NOW() 
     WHERE id = $5 
     RETURNING *`,
    [key, value, category, description, id]
  );
  return result.rows[0] || null;
}

export async function deleteContent(id) {
  const result = await pool.query(
    'DELETE FROM content WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] || null;
}

// Limit settings
export async function getLimitSetting(key) {
  const result = await pool.query(
    'SELECT setting_value FROM limit_settings WHERE setting_key = $1',
    [key]
  );
  return result.rows[0]?.setting_value || null;
}

export async function setLimitSetting(key, value, description = null) {
  const result = await pool.query(
    `INSERT INTO limit_settings (setting_key, setting_value, description) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (setting_key) 
     DO UPDATE SET setting_value = $2, description = COALESCE($3, limit_settings.description), updated_at = NOW() 
     RETURNING *`,
    [key, value, description]
  );
  return result.rows[0];
}

export async function getAllLimitSettings() {
  const result = await pool.query(
    'SELECT * FROM limit_settings ORDER BY setting_key'
  );
  return result.rows;
}

// User limit overrides
export async function getUserLimitOverride(userId, fingerprint = null) {
  if (userId) {
    const result = await pool.query(
      'SELECT * FROM user_limit_overrides WHERE user_id = $1 AND fingerprint IS NULL',
      [userId]
    );
    return result.rows[0] || null;
  } else if (fingerprint) {
    const result = await pool.query(
      'SELECT * FROM user_limit_overrides WHERE fingerprint = $1 AND user_id IS NULL',
      [fingerprint]
    );
    return result.rows[0] || null;
  }
  return null;
}

export async function setUserLimitOverride(userId, fingerprint, limitEnabled, maxLinks, notes = null) {
  const result = await pool.query(
    `INSERT INTO user_limit_overrides (user_id, fingerprint, limit_enabled, max_links, notes) 
     VALUES ($1, $2, $3, $4, $5) 
     ON CONFLICT (user_id, fingerprint) 
     DO UPDATE SET limit_enabled = $3, max_links = $4, notes = $5, updated_at = NOW() 
     RETURNING *`,
    [userId || null, fingerprint || null, limitEnabled, maxLinks, notes]
  );
  return result.rows[0];
}

export async function deleteUserLimitOverride(userId, fingerprint) {
  const result = await pool.query(
    'DELETE FROM user_limit_overrides WHERE (user_id = $1 OR $1 IS NULL) AND (fingerprint = $2 OR $2 IS NULL) RETURNING *',
    [userId || null, fingerprint || null]
  );
  return result.rows[0] || null;
}

export async function getAllUserLimitOverrides() {
  const result = await pool.query(
    `SELECT ulo.*, u.email, u.name 
     FROM user_limit_overrides ulo
     LEFT JOIN users u ON ulo.user_id = u.id
     ORDER BY ulo.created_at DESC`
  );
  return result.rows;
}

// Users (local authentication)
export async function getUserByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

export async function getUserById(id) {
  const result = await pool.query(
    'SELECT id, email, name, email_verified, created_at, password_hash FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Get all users with their link counts
export async function getAllUsersWithLinkCounts() {
  const result = await pool.query(
    `SELECT 
      u.id,
      u.email,
      u.name,
      u.created_at,
      u.email_verified,
      COUNT(url.id) as link_count
    FROM users u
    LEFT JOIN urls url ON url.user_id = u.id
    GROUP BY u.id, u.email, u.name, u.created_at, u.email_verified
    ORDER BY u.created_at DESC`
  );
  return result.rows.map(row => ({
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    emailVerified: row.email_verified,
    linkCount: parseInt(row.link_count || 0, 10)
  }));
}

// Get aggregated guest users (anonymous) by clientUuid
export async function getAggregatedGuestUsers() {
  const result = await pool.query(
    `SELECT 
      creator_token as client_uuid,
      COUNT(id) as usage_count,
      MAX(created_at) as last_active,
      MAX(creator_ip) as last_ip
    FROM urls
    WHERE user_id IS NULL AND creator_token IS NOT NULL
    GROUP BY creator_token
    ORDER BY last_active DESC`
  );
  return result.rows.map(row => ({
    clientUuid: row.client_uuid,
    usageCount: parseInt(row.usage_count || 0, 10),
    lastActive: row.last_active,
    lastIp: row.last_ip
  }));
}

export async function createUser(email, passwordHash, name = null) {
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, name) 
     VALUES ($1, $2, $3) 
     RETURNING id, email, name, email_verified, created_at`,
    [email.toLowerCase(), passwordHash, name]
  );
  return result.rows[0];
}

// Create user without password (for OAuth users)
export async function createUserWithoutPassword(email, name = null, userId = null) {
  // First check if user exists
  const existing = await getUserByEmail(email);
  if (existing) {
    return existing;
  }
  
  // Generate a placeholder password hash (for NOT NULL constraint)
  // OAuth users won't use this, but we need it for the database constraint
  const bcrypt = await import('bcrypt');
  const placeholderHash = await bcrypt.hash('oauth_user_no_password_' + Date.now(), 10);
  
  const result = userId 
    ? await pool.query(
        `INSERT INTO users (id, email, password_hash, name, email_verified) 
         VALUES ($1, $2, $3, $4, TRUE) 
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, email, name, email_verified, created_at, password_hash`,
        [userId, email.toLowerCase(), placeholderHash, name]
      )
    : await pool.query(
        `INSERT INTO users (email, password_hash, name, email_verified) 
         VALUES ($1, $2, $3, TRUE) 
         RETURNING id, email, name, email_verified, created_at, password_hash`,
        [email.toLowerCase(), placeholderHash, name]
  );
  return result.rows[0];
}

export async function updateUserPassword(userId, passwordHash) {
  const result = await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name',
    [passwordHash, userId]
  );
  return result.rows[0] || null;
}

export async function updateUser(userId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex}`);
    values.push(updates.email.toLowerCase());
    paramIndex++;
  }

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`);
    values.push(updates.name);
    paramIndex++;
  }

  if (updates.email_verified !== undefined) {
    fields.push(`email_verified = $${paramIndex}`);
    values.push(updates.email_verified);
    paramIndex++;
  }

  if (fields.length === 0) {
    // No fields to update
    return await getUserById(userId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, name, email_verified, created_at, updated_at`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

// Admin statistics
export async function getTotalLinksCount() {
  try {
    // Используем простой COUNT для динамического подсчета всех ссылок
    const result = await pool.query('SELECT COUNT(*) as count FROM urls');
    const count = parseInt(result.rows[0]?.count || '0', 10);
    console.log('📊 Total links count from DB:', count);
    return count;
  } catch (error) {
    console.error('❌ Error getting total links count:', error);
    return 0;
  }
}

export async function getTotalClicksCount() {
  try {
    let totalCount = 0;
    
    // Count from stats table (current table) - динамический подсчет всех кликов
    try {
      const statsResult = await pool.query('SELECT COUNT(*) as count FROM stats');
      const statsCount = parseInt(statsResult.rows[0]?.count || '0', 10);
      console.log('📊 Stats table count:', statsCount);
      totalCount += statsCount;
    } catch (statsError) {
      console.warn('⚠️ Error counting from stats table:', statsError.message);
    }
    
    // Check if clicks table exists and count from it (old Supabase table)
    try {
      // First check if table exists
      const tableCheckResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'clicks'
        ) as exists
      `);
      
      if (tableCheckResult.rows[0]?.exists === true) {
        // Table exists, count records
        const clicksCountResult = await pool.query('SELECT COUNT(*) as count FROM clicks');
        const clicksCount = parseInt(clicksCountResult.rows[0]?.count || '0', 10);
        console.log('📊 Clicks table count (old data):', clicksCount);
        totalCount += clicksCount;
      } else {
        console.log('ℹ️ Clicks table does not exist (using only stats table)');
      }
    } catch (clicksError) {
      // Table doesn't exist or error - ignore
      console.log('ℹ️ Clicks table check failed (this is OK if table does not exist):', clicksError.message);
    }
    
    console.log('📊 Total clicks count from all sources:', totalCount);
    return totalCount;
  } catch (error) {
    console.error('❌ Error getting total clicks count:', error);
    return 0;
  }
}

export async function getAdminStats() {
  const totalLinks = await getTotalLinksCount();
  const totalClicks = await getTotalClicksCount();
  return {
    totalLinks,
    totalClicks,
  };
}

// Email tokens (verification and password reset)
export async function createEmailToken(userId, token, type, expiresAt) {
  try {
    const result = await pool.query(
      `INSERT INTO email_tokens (user_id, token, type, expires_at) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [userId, token, type, expiresAt]
    );
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error creating email token:', error);
    if (error.code === '42P01') { // Table doesn't exist
      console.error('❌ Table email_tokens does not exist. Please run migration: migrations/add_email_tokens.sql');
      throw new Error('Email tokens table not found. Please run database migration.');
    }
    throw error;
  }
}

export async function getEmailToken(token, type) {
  try {
    const result = await pool.query(
      `SELECT et.*, u.email, u.name 
       FROM email_tokens et
       JOIN users u ON et.user_id = u.id
       WHERE et.token = $1 AND et.type = $2 AND et.used = FALSE AND et.expires_at > NOW()`,
      [token, type]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error getting email token:', error);
    if (error.code === '42P01') { // Table doesn't exist
      console.error('❌ Table email_tokens does not exist. Please run migration: migrations/add_email_tokens.sql');
      return null; // Return null instead of throwing to allow graceful handling
    }
    throw error;
  }
}

export async function markEmailTokenAsUsed(token) {
  try {
    const result = await pool.query(
      `UPDATE email_tokens SET used = TRUE WHERE token = $1 RETURNING *`,
      [token]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error marking email token as used:', error);
    if (error.code === '42P01') { // Table doesn't exist
      console.error('❌ Table email_tokens does not exist. Please run migration: migrations/add_email_tokens.sql');
      // Don't throw - allow operation to continue
      return null;
    }
    throw error;
  }
}

export async function deleteExpiredTokens() {
  try {
    const result = await pool.query(
      `DELETE FROM email_tokens WHERE expires_at < NOW() RETURNING *`
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Error deleting expired tokens:', error);
    if (error.code === '42P01') { // Table doesn't exist
      console.error('❌ Table email_tokens does not exist. Please run migration: migrations/add_email_tokens.sql');
      return [];
    }
    throw error;
  }
}

// Optimized function to get all URLs with stats and user info in a single query
// This avoids N+1 query problem and significantly improves performance
export async function getAllUrlsWithStatsOptimized(filterType = 'all', userIdFilter = null, clientUuidFilter = null) {
  let baseQuery;
  let params = [];
  let paramIndex = 1;  // Build WHERE clause based on filters
  if (userIdFilter) {
    baseQuery = `SELECT * FROM urls WHERE user_id = $${paramIndex} ORDER BY created_at DESC`;
    params.push(userIdFilter);
  } else if (clientUuidFilter) {
    baseQuery = `SELECT * FROM urls WHERE creator_token = $${paramIndex} AND user_id IS NULL ORDER BY created_at DESC`;
    params.push(clientUuidFilter);
  } else if (filterType === 'registered') {
    baseQuery = `SELECT * FROM urls WHERE user_id IS NOT NULL ORDER BY created_at DESC`;
  } else if (filterType === 'anonymous') {
    baseQuery = `SELECT * FROM urls WHERE user_id IS NULL ORDER BY created_at DESC`;
  } else {
    baseQuery = `SELECT * FROM urls ORDER BY created_at DESC`;
  }

  // Main optimized query with JOINs and aggregations
  const query = `
    SELECT 
      u.id,
      u.short_code,
      u.original_url,
      u.user_id,
      u.created_at,
      u.custom_domain,
      u.creator_token,
      u.creator_ip,
      COUNT(s.id) as clicks,
      u_user.email as user_email,
      u_user.name as user_name,
      COALESCE(anon_counts.link_count, 0) as anonymous_link_count
    FROM (${baseQuery}) u
    LEFT JOIN stats s ON u.id = s.url_id
    LEFT JOIN users u_user ON u.user_id = u_user.id
    LEFT JOIN (
      SELECT creator_token, COUNT(*) as link_count
      FROM urls
      WHERE user_id IS NULL AND creator_token IS NOT NULL
      GROUP BY creator_token
    ) anon_counts ON u.creator_token = anon_counts.creator_token
    GROUP BY u.id, u.short_code, u.original_url, u.user_id, u.created_at, 
             u.custom_domain, u.creator_token, u.creator_ip, 
             u_user.email, u_user.name, anon_counts.link_count
    ORDER BY u.created_at DESC
  `;

  const result = await pool.query(query, params);
  
  // Transform results to match expected format
  return result.rows.map(row => {
    const MAX_LINKS = 5;
    const result = {
      id: row.id,
      short_code: row.short_code,
      original_url: row.original_url,
      user_id: row.user_id,
      created_at: row.created_at,
      custom_domain: row.custom_domain,
      clicks: parseInt(row.clicks || 0, 10),
      creator_token: row.creator_token,
      creator_ip: row.creator_ip,
    };

    // Add user info for registered users
    if (row.user_id) {
      result.user_email = row.user_email;
      result.user_name = row.user_name || row.user_email;
    }

    // Add anonymous user info
    if (!row.user_id) {
      result.client_uuid = row.creator_token;
      if (row.creator_token) {
        const usageCount = parseInt(row.anonymous_link_count || 0, 10);
        result.usage_count = usageCount;
        result.remaining_limit = Math.max(0, MAX_LINKS - usageCount);
        result.limit_reached = usageCount >= MAX_LINKS;
        result.limit_usage = {
          used: usageCount,
          max: MAX_LINKS
        };
      }
    }

    return result;
  });
}