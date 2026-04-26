import posthog from 'posthog-js';

// PostHog configuration
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_3838bamhRaVT2s9ojOXQHCE9KPiEhWvLbIGS7ckKfEN';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export function initPostHog() {
  if (typeof window === 'undefined') {
    return;
  }

  // Only initialize if API key is provided
  if (!POSTHOG_KEY) {
    // Use console.warn for important messages even in production
    console.warn('⚠️ PostHog: API key not provided. Skipping initialization.');
    return;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      ui_host: 'https://us.i.posthog.com',
      debug: import.meta.env.DEV, // Only enable debug in development
      loaded: (posthogInstance) => {
        // Only log in development
        if (import.meta.env.DEV) {
          console.log('✅ PostHog initialized successfully');
        }
        // Make PostHog available on window for global access
        if (typeof window !== 'undefined') {
          (window as any).posthog = posthogInstance || posthog;
          if (import.meta.env.DEV) {
            console.log('✅ PostHog available on window.posthog');
          }
        }
        // Identify user if available
        if (posthogInstance && import.meta.env.DEV) {
          console.log('📊 PostHog ready to track events');
        }
      },
      capture_pageview: true, // Automatically capture pageviews
      capture_pageleave: true, // Automatically capture pageleave events
      autocapture: true, // Automatically capture clicks and form submissions
    });
    
    // Also set on window immediately in case loaded callback hasn't fired yet
    if (typeof window !== 'undefined') {
      (window as any).posthog = posthog;
    }
  } catch (error) {
    // Keep console.error for errors even in production
    console.error('❌ PostHog initialization error:', error);
  }
}

export default posthog;

