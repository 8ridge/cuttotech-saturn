import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogoLink, X } from './design/icons';
import { GoogleLogo, GitHubLogo } from './design/shared';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user?: { is_admin?: boolean } | null;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '' });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSignUp = mode === 'signup';

  const persistSession = async (data: { user: Record<string, unknown>; access_token: string }) => {
    const { setAuthSession } = await import('../utils/auth');
    setAuthSession({
      access_token: data.access_token,
      user: {
        id: data.user.id as string,
        email: data.user.email as string,
        name: (data.user.name as string) || '',
        email_verified: (data.user.email_verified as boolean) || false,
        created_at: (data.user.created_at as string) || new Date().toISOString(),
        is_admin: (data.user.is_admin as boolean) || false,
      },
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl('signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || data.message || t('errors.signupError', 'Registration failed'));
        setLoading(false);
        return;
      }
      if (data.success && data.user && data.access_token) {
        await persistSession(data);
        // GA4 / Google Ads conversion event
        if (typeof window !== 'undefined') {
          (window as unknown as { dataLayer?: unknown[] }).dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer || [];
          (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
            event: 'sign_up',
            method: 'email',
            user_id: data.user.id,
          });
        }
        onSuccess();
        onClose();
      } else {
        setError(t('errors.unexpectedResponse', 'Unexpected server response'));
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError(t('errors.connectionError', 'Connection error'));
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl('login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || data.message || t('errors.loginError', 'Invalid email or password'));
        setLoading(false);
        return;
      }
      if (data.success && data.user && data.access_token) {
        await persistSession(data);
        if (typeof window !== 'undefined') {
          (window as unknown as { dataLayer?: unknown[] }).dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer || [];
          (window as unknown as { dataLayer: unknown[] }).dataLayer.push({ event: 'login', method: 'email' });
        }
        onSuccess();
        onClose();
      } else {
        setError(t('errors.unexpectedResponse', 'Unexpected server response'));
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(t('errors.connectionError', 'Connection error'));
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const redirectAfterAuth = window.location.pathname + window.location.search;
      const oauthUrl = `${getApiUrl('auth/google')}?redirect=${encodeURIComponent(redirectAfterAuth)}`;
      window.location.href = oauthUrl;
    } catch {
      setError(t('errors.googleAuthError', 'Google sign-in failed'));
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}/>
      <div className="ctt-card anim-scale-in" style={{ position: 'relative', maxWidth: 480, width: '100%', padding: 36, borderRadius: 20, boxShadow: '0 20px 60px rgba(15,23,42,0.25)', zIndex: 1 }}>
        <button onClick={onClose} className="btn-icon" style={{ position: 'absolute', top: 16, right: 16 }}>
          <X />
        </button>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="ctt-logomark" style={{ width: 48, height: 48, borderRadius: 12 }}>
            <LogoLink />
          </div>
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 600, textAlign: 'center', margin: '20px 0 4px', letterSpacing: '-0.02em' }}>
          {isSignUp ? t('auth.signupTitle', 'Create your account') : t('auth.signinTitle', 'Welcome back')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', textAlign: 'center', margin: 0 }}>
          {isSignUp ? t('auth.signupSubtitle', 'Start measuring links in under a minute') : t('auth.signinSubtitle', 'Sign in to your account')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => { setMode('signin'); setError(''); }} style={{ padding: '10px 4px', fontSize: 14, fontWeight: 500, color: !isSignUp ? 'var(--accent)' : 'var(--text-2)', borderBottom: `2px solid ${!isSignUp ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, background: 'none', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}>
            {t('auth.signinTab', 'Sign in')}
          </button>
          <button onClick={() => { setMode('signup'); setError(''); }} style={{ padding: '10px 4px', fontSize: 14, fontWeight: 500, color: isSignUp ? 'var(--accent)' : 'var(--text-2)', borderBottom: `2px solid ${isSignUp ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, background: 'none', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}>
            {t('auth.signupTab', 'Create account')}
          </button>
        </div>

        <form onSubmit={isSignUp ? handleSignup : handleLogin} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSignUp && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>
                {t('auth.name', 'Name')}
              </label>
              <input className="ctt-input" placeholder="Sam Torres" value={signupData.name} onChange={e => setSignupData({ ...signupData, name: e.target.value })} required/>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>
              {t('auth.email', 'Email')}
            </label>
            <input className="ctt-input" type="email" placeholder="you@example.com"
              value={isSignUp ? signupData.email : loginData.email}
              onChange={e => isSignUp ? setSignupData({ ...signupData, email: e.target.value }) : setLoginData({ ...loginData, email: e.target.value })}
              required/>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 6 }}>
              {t('auth.password', 'Password')}
            </label>
            <input className="ctt-input" type="password" placeholder="••••••••" minLength={6}
              value={isSignUp ? signupData.password : loginData.password}
              onChange={e => isSignUp ? setSignupData({ ...signupData, password: e.target.value }) : setLoginData({ ...loginData, password: e.target.value })}
              required/>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', borderLeft: '3px solid #EF4444', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#991B1B' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? (isSignUp ? t('auth.creating', 'Creating account...') : t('auth.signingIn', 'Signing in...')) : (isSignUp ? t('auth.createAccount', 'Create Account') : t('auth.signIn', 'Sign In'))}
          </button>

          {isSignUp ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', margin: 0 }}>
              {t('auth.terms', 'By signing up you agree to our')} <a href="#" style={{ color: 'var(--accent)' }}>Terms</a> {t('auth.and', 'and')} <a href="#" style={{ color: 'var(--accent)' }}>Privacy Policy</a>.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-3)', fontSize: 12 }}>
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }}/>
                {t('auth.or', 'or')}
                <div style={{ height: 1, flex: 1, background: 'var(--border)' }}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ height: 42, width: '100%' }} onClick={handleGoogleSignIn} disabled={loading}>
                  <GoogleLogo /> Google
                </button>
                <button type="button" className="btn btn-secondary" style={{ height: 42, width: '100%' }} disabled>
                  <GitHubLogo /> GitHub
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
