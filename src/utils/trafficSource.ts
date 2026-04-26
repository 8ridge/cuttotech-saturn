/**
 * Traffic Source Tracking Utility
 * Collects and manages UTM parameters, gclid, and referrer for advertising campaign tracking
 */

export interface TrafficSourceData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  referrer?: string;
}

const STORAGE_KEY = 'cuttech_traffic_source';

/**
 * Extract UTM parameters and gclid from current URL
 */
export function extractTrafficSourceFromUrl(): TrafficSourceData {
  if (typeof window === 'undefined') {
    return {};
  }

  const urlParams = new URLSearchParams(window.location.search);
  const data: TrafficSourceData = {};

  // Extract UTM parameters
  const utmSource = urlParams.get('utm_source');
  const utmMedium = urlParams.get('utm_medium');
  const utmCampaign = urlParams.get('utm_campaign');
  const utmContent = urlParams.get('utm_content');
  const utmTerm = urlParams.get('utm_term');
  const gclid = urlParams.get('gclid');

  if (utmSource) data.utm_source = utmSource;
  if (utmMedium) data.utm_medium = utmMedium;
  if (utmCampaign) data.utm_campaign = utmCampaign;
  if (utmContent) data.utm_content = utmContent;
  if (utmTerm) data.utm_term = utmTerm;
  if (gclid) data.gclid = gclid;

  // Get referrer from document.referrer
  if (document.referrer && document.referrer !== '') {
    try {
      // Only store domain, not full URL for privacy
      const referrerUrl = new URL(document.referrer);
      data.referrer = referrerUrl.origin;
    } catch (e) {
      // If referrer is not a valid URL, store as-is
      data.referrer = document.referrer;
    }
  }

  return data;
}

/**
 * Save traffic source data to sessionStorage
 * This persists across page navigations within the same session
 */
export function saveTrafficSourceToStorage(data: TrafficSourceData): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // Only save if we have at least one UTM parameter or gclid
    const hasData = data.utm_source || data.utm_medium || data.utm_campaign || 
                    data.utm_content || data.utm_term || data.gclid;
    
    if (hasData || data.referrer) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.warn('Failed to save traffic source to sessionStorage:', e);
  }
}

/**
 * Load traffic source data from sessionStorage
 */
export function loadTrafficSourceFromStorage(): TrafficSourceData {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load traffic source from sessionStorage:', e);
  }

  return {};
}

/**
 * Initialize traffic source tracking
 * Call this on page load to capture UTM parameters from URL
 */
export function initTrafficSourceTracking(): TrafficSourceData {
  // Extract from current URL
  const urlData = extractTrafficSourceFromUrl();
  
  // Load existing data from storage
  const storedData = loadTrafficSourceFromStorage();
  
  // Merge: URL data takes precedence (newer), but keep stored data if URL doesn't have it
  const mergedData: TrafficSourceData = {
    ...storedData,
    ...urlData, // URL parameters override stored data
  };

  // Save merged data back to storage
  if (Object.keys(mergedData).length > 0) {
    saveTrafficSourceToStorage(mergedData);
  }

  return mergedData;
}

/**
 * Get current traffic source data (from storage)
 */
export function getTrafficSourceData(): TrafficSourceData {
  return loadTrafficSourceFromStorage();
}

/**
 * Clear traffic source data from storage
 */
export function clearTrafficSourceData(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear traffic source from sessionStorage:', e);
  }
}

