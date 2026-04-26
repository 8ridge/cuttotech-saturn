// GeoIP utility for country detection
import geoip from 'geoip-lite';
import logger from './logger.js';

/**
 * Get country code (2-letter, uppercase) by IP address
 * @param {string} ip - IP address (IPv4 or IPv6)
 * @param {object} log - Optional logger instance (defaults to global logger)
 * @returns {string|null} - Country code (e.g., 'US', 'NG', 'PK') or null if not found
 */
export function getCountryByIp(ip, log = logger) {
  if (!ip || ip === 'unknown') {
    return null;
  }

  try {
    const geo = geoip.lookup(ip);
    
    if (!geo || !geo.country) {
      return null;
    }

    const countryCode = geo.country.toUpperCase();
    
    // Log only final result (success)
    log.debug({
      event: 'geoip_lookup',
      ip,
      country: countryCode,
      success: true,
    });
    
    return countryCode;
  } catch (error) {
    // Log only on complete failure
    log.error({
      event: 'geoip_lookup_error',
      ip,
      error: error.message,
      success: false,
    });
    return null;
  }
}

