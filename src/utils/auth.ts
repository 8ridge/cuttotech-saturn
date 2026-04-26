// Local authentication utilities (replaces Supabase Auth for session management)

const AUTH_TOKEN_KEY = 'cuttech_auth_token';
const AUTH_USER_KEY = 'cuttech_auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  email_verified: boolean;
  created_at: string;
  is_admin?: boolean; // Admin status from database
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

// Store session in localStorage
export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
}

// Get session from localStorage
export function getAuthSession(): AuthSession | null {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  
  if (!token || !userStr) {
    return null;
  }
  
  try {
    const user = JSON.parse(userStr) as AuthUser;
    return {
      access_token: token,
      user,
    };
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
}

// Clear session
export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

// Get auth token
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Get current user
export function getCurrentUser(): AuthUser | null {
  const session = getAuthSession();
  return session?.user || null;
}








