// Monetization service - handles offer logic and click processing
import pool from '../db.js';
import { getCountryByIp } from '../utils/geoip.js';
import { OFFER_PERCENTAGE, OFFERS } from '../config/monetization.js';
import logger from '../utils/logger.js';

/**
 * Process click and determine if offer should be shown
 * @param {Object} urlRecord - URL record from database
 * @param {Object} req - Express request object (must have req.log from requestLogger middleware)
 * @returns {Promise<{redirectUrl: string}>} - Redirect URL (offer or direct)
 */
export async function processClick(urlRecord, req) {
  // Use request logger if available, fallback to global logger
  const log = req.log || logger;
  
  // 1. Get visitor IP safely
  const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.ip || 'unknown';
  
  // 2. Get visitor UUID
  const visitorUuid = req.clientUuid;
  
  // 3. Determine country ONCE at the start (optimization: avoid duplicate GeoIP lookups)
  const country = getCountryByIp(ip, log);
  
  // Default action and reason
  let action = 'DIRECT';
  let reason = 'DEFAULT';
  let offerUrl = null;
  
  // 4. ANTI-FRAUD: Check if visitor is the creator
  if (urlRecord.creator_token && visitorUuid && urlRecord.creator_token === visitorUuid) {
    action = 'DIRECT';
    reason = 'IS_CREATOR_UUID';
  } else if (urlRecord.creator_ip && ip !== 'unknown' && urlRecord.creator_ip === ip) {
    action = 'DIRECT';
    reason = 'IS_CREATOR_IP';
  } else {
    // 5. GEO TARGETING: Check if country has offers
    if (!country || !OFFERS[country]) {
      action = 'DIRECT';
      reason = 'GEO_MISMATCH';
    } else {
      // 6. TRAFFIC SPLIT: Random rotation
      const randomValue = Math.random() * 100;
      
      if (randomValue > OFFER_PERCENTAGE) {
        action = 'DIRECT';
        reason = 'LUCKY_SKIP';
      } else {
        action = 'SHOW_OFFER';
        offerUrl = OFFERS[country];
        reason = 'OFFER_SHOWN';
      }
    }
  }
  
  // 7. Structured logging of monetization decision
  log.info({
    event: 'monetization_decision',
    urlId: urlRecord.id,
    shortCode: urlRecord.short_code,
    action,
    reason,
    country: country || null,
    ip: ip !== 'unknown' ? ip : null,
    visitorUuid: visitorUuid || null,
    offerUrl: offerUrl || null,
    showedOffer: action === 'SHOW_OFFER',
  });
  
  // 8. DATABASE LOGGING: Fire-and-forget (don't await, don't block redirect)
  const showedOffer = action === 'SHOW_OFFER';
  
  pool.query(
    `INSERT INTO offer_decisions (url_id, ip_address, country_code, showed_offer, decision_reason, offer_url)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      urlRecord.id,
      ip !== 'unknown' ? ip : null,
      country || null,
      showedOffer,
      reason,
      offerUrl
    ]
  ).catch(err => {
    log.error({
      event: 'offer_decision_db_error',
      error: err.message,
      urlId: urlRecord?.id,
      ip,
      country,
    });
  });
  
  // 9. RETURN redirect URL
  const redirectUrl = action === 'SHOW_OFFER' ? offerUrl : urlRecord.original_url;
  
  return { redirectUrl };
}

