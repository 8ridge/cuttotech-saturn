// API Configuration
// Uses local Express server

const getEnv = (key: string) => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  }
  return undefined;
};

// Local server URL (your own backend)
// In development, use direct port 3000 to avoid Vite proxy issues
// In production, use same host (will be proxied by Nginx)
function getLocalApiUrl(): string {
  const envUrl = getEnv("VITE_API_URL");
  if (envUrl) {
    return envUrl;
  }
  
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Always use port 3000 in development (localhost or 127.0.0.1)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return "http://localhost:3000";
    }
    // In production, use same host
    return `${window.location.protocol}//${window.location.host}`;
  }
  
  return "http://localhost:3000";
}

const LOCAL_API_URL = getLocalApiUrl();

// Helper function to build API URLs
export function getApiUrl(endpoint: string): string {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  
  const url = `${LOCAL_API_URL}/${cleanEndpoint}`;
  
  // Debug logging for API URL construction
  if (typeof window !== "undefined" && window.location.hostname === 'localhost') {
    console.log('[API Config] getApiUrl:', { endpoint, url, LOCAL_API_URL });
  }
  
  return url;
}

// Export for debugging
export const API_CONFIG = {
  apiBaseUrl: LOCAL_API_URL,
  localApiUrl: LOCAL_API_URL,
};

