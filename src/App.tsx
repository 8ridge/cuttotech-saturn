import { useState, useEffect, lazy, Suspense } from "react";
import { ContentProvider } from "./utils/content";
import Header from "./components/Header";
import { Toaster } from "./components/ui/sonner";
import { initPostHog } from "./utils/posthog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button } from "./components/ui/button";
import { initTrafficSourceTracking } from "./utils/trafficSource";
import RedirectPage from "./pages/RedirectPage";

// Lazy load components for better performance
const HomePage = lazy(() => import("./components/HomePage"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const StatsView = lazy(() => import("./components/StatsView"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
// AuthModal with error handling for lazy loading
const AuthModal = lazy(() => 
  import("./components/AuthModal").catch((error) => {
    console.error("Failed to load AuthModal:", error);
    // Return a fallback component that shows an error
    return {
      default: () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Loading error
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Failed to load the registration form. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    };
  })
);
const PrivacyPolicy = lazy(() => import("./components/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));

type View =
  | "home"
  | "dashboard"
  | "stats"
  | "admin"
  | "settings"
  | "privacy"
  | "terms";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentView, setCurrentView] = useState<View>("home");
  const [viewHistory, setViewHistory] = useState<View[]>(["home"]);
  const [selectedShortCode, setSelectedShortCode] =
    useState<string>("");

  // Dark mode — applied directly to DOM (avoids React re-render delay on toggle)
  const [, _forceUpdate] = useState(0);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const toggleDark = () => {
    const html = document.documentElement;
    const next = !html.classList.contains('dark');
    html.classList.toggle('dark', next);
    try { localStorage.setItem('ctt-theme', next ? 'dark' : 'light'); } catch {}
    _forceUpdate(n => n + 1);
  };

  // Initialize PostHog on app mount
  useEffect(() => {
    initPostHog();
  }, []);

  // Initialize traffic source tracking on app mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initTrafficSourceTracking();
    }
  }, []);
  
  const navigateToView = (view: View, skipHistory = false, code?: string) => {
    // Only add to history if we're actually changing views and not skipping history
    if (view !== currentView || code !== selectedShortCode) {
      console.log('🧭 Navigating to view:', { view, code, currentView, selectedShortCode });
      if (!skipHistory) {
        setViewHistory(prev => {
          // Add current view to history
          const newHistory = [...prev, currentView];
          return newHistory;
        });
        // Update URL with path-based routing
        if (typeof window !== 'undefined') {
          let newPath = '/';
          if (view === 'dashboard') {
            newPath = '/dashboard';
          } else if (view === 'stats') {
            newPath = code ? `/stats/${code}` : '/stats';
          } else if (view === 'admin') {
            newPath = '/admin';
          } else if (view === 'settings') {
            newPath = '/settings';
          } else if (view === 'privacy') {
            newPath = '/privacy';
          } else if (view === 'terms') {
            newPath = '/terms';
          }
          
          console.log('🧭 Updating URL to:', newPath);
          window.history.pushState({ view, code, internal: true }, '', newPath);
        }
      }
      setCurrentView(view);
      if (code) {
        setSelectedShortCode(code);
      } else if (view !== 'stats') {
        setSelectedShortCode('');
      }
      
      // Scroll to top when navigating to privacy or terms page
      if ((view === 'privacy' || view === 'terms') && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };
  
  const navigateBack = () => {
    // Use browser's back button - this will trigger popstate event
    // The popstate handler will restore the correct view
    if (typeof window !== 'undefined') {
      // Use viewHistory to check if we have navigation history
      // This satisfies TypeScript and provides a fallback
      if (viewHistory.length === 0 && currentView === "home") {
        // Already at home with no history - do nothing
        return;
      }
      window.history.back();
    }
  };

  // Restore view from URL on initial load (before user check)
      // Check registration parameter on page load
  useEffect(() => {
    if (typeof window !== 'undefined' && !loading) {
      const urlParams = new URLSearchParams(window.location.search);
      const registrationParam = urlParams.get('registration');
      
      // If registration parameter exists and user is not authenticated, open modal
      if (registrationParam === 'true' && !user) {
        console.log('🔍 Registration parameter detected, opening auth modal');
        setShowAuthModal(true);
      }
    }
  }, [loading, user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const codeParam = urlParams.get('code');
      
      console.log('🔍 Restoring view from URL (initial):', { pathname, codeParam, fullUrl: window.location.href });
      
      // Skip OAuth paths - let server handle them
      if (pathname.startsWith('/auth/')) {
        console.log('🔐 OAuth path detected, skipping view restoration');
        return;
      }
      
      // Parse pathname to determine view
      let viewParam: View | null = null;
      let codeFromPath: string | null = null;
      
      if (pathname === '/dashboard') {
        viewParam = 'dashboard';
      } else if (pathname === '/admin') {
        viewParam = 'admin';
      } else if (pathname === '/settings') {
        viewParam = 'settings';
      } else if (pathname === '/privacy') {
        viewParam = 'privacy';
      } else if (pathname === '/terms') {
        viewParam = 'terms';
      } else if (pathname === '/stats' || pathname.startsWith('/stats/')) {
        // Extract code from path like /stats/abc123
        const statsMatch = pathname.match(/^\/stats\/([^/]+)$/);
        if (statsMatch) {
          // Valid stats URL with code
          viewParam = 'stats';
          codeFromPath = statsMatch[1];
        } else {
          // /stats/ without code - redirect to dashboard (if logged in) or home
          // Set the redirect view, the code below will handle it
          if (user) {
            viewParam = 'dashboard';
          } else {
            viewParam = 'home';
          }
          // Clear stats view since we're redirecting
          setSelectedShortCode('');
        }
      } else if (pathname === '/' || pathname === '') {
        viewParam = 'home';
      }
      
      // Fallback to query params for backward compatibility
      if (!viewParam) {
        const viewFromQuery = urlParams.get('view') as View | null;
        if (viewFromQuery && ['home', 'dashboard', 'stats', 'admin', 'settings', 'privacy', 'terms'].includes(viewFromQuery)) {
          viewParam = viewFromQuery;
        }
      }
      
      if (viewParam && ['home', 'dashboard', 'stats', 'admin', 'settings', 'privacy', 'terms'].includes(viewParam)) {
        console.log('✅ Restoring view:', viewParam);
        setCurrentView(viewParam);
        
        const finalCode = codeFromPath || codeParam;
        if (viewParam === 'stats' && finalCode) {
          console.log('✅ Restoring shortCode:', finalCode);
          setSelectedShortCode(finalCode);
        }
        
        // Update URL to clean path-based format if needed
        if (viewParam === 'home' && pathname !== '/') {
          window.history.replaceState({ view: viewParam, internal: true }, '', '/');
        } else if (viewParam !== 'home') {
          const expectedPath = viewParam === 'stats' && finalCode 
            ? `/stats/${finalCode}` 
            : `/${viewParam}`;
          if (pathname !== expectedPath) {
            window.history.replaceState({ view: viewParam, code: finalCode, internal: true }, '', expectedPath);
          }
        }
      } else {
        console.log('ℹ️ No view in URL, setting default home');
        // No view in URL, set default
        if (pathname !== '/') {
          window.history.replaceState({ view: 'home', internal: true }, '', '/');
        }
      }
    }
  }, []); // Run only once on mount

  useEffect(() => {
    // Check for OAuth callback in URL query params (our own OAuth flow)
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const oauth = urlParams.get('oauth');

      if (token && oauth === 'google') {
        console.log('🔐 OAuth callback detected, processing token...');
        try {
          // Verify token with server
          const { getApiUrl } = await import('./utils/api/config');
          const response = await fetch(getApiUrl('user/profile'), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ OAuth user authenticated:', data.user.email);
            
            // Store session
            const { setAuthSession } = await import('./utils/auth');
            const localSession = {
              access_token: token,
              user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name || '',
                email_verified: data.user.email_verified || false,
                created_at: data.user.created_at,
              },
            };
            setAuthSession(localSession);
            
            setUser({
              id: localSession.user.id,
              email: localSession.user.email,
              user_metadata: { name: localSession.user.name },
              access_token: token,
            });
            
            // Google Ads conversion tracking for OAuth login/registration
            if (typeof window !== 'undefined') {
              const transactionId = `oauth_${localSession.user.id}_${Date.now()}`;
              
              // Get Google Ads parameters from URL
              const urlParams = new URLSearchParams(window.location.search);
              const gclid = urlParams.get('gclid');
              const gclsrc = urlParams.get('gclsrc');
              const wbraid = urlParams.get('wbraid');
              const gbraid = urlParams.get('gbraid');
              
              // Build conversion parameters object
              const conversionParams: any = {
                'send_to': 'AW-17745783756/jHaRCKiB3NEbEMzX7I1C',
                'value': 1.0,
                'currency': 'USD',
                'transaction_id': transactionId
              };
              
              // Add Google Ads parameters if they exist
              if (gclid) {
                conversionParams['gclid'] = gclid;
              }
              if (gclsrc) {
                conversionParams['gclsrc'] = gclsrc;
              }
              if (wbraid) {
                conversionParams['wbraid'] = wbraid;
              }
              if (gbraid) {
                conversionParams['gbraid'] = gbraid;
              }
              
              const sendConversion = () => {
                if ((window as any).gtag) {
                  try {
                    (window as any).gtag('event', 'conversion', conversionParams);
                    console.log('✅ Google Ads: OAuth conversion sent', {
                      transaction_id: transactionId,
                      has_gclid: !!gclid,
                      has_gclsrc: !!gclsrc
                    });
                  } catch (error) {
                    console.error('⚠️ Google Ads conversion error:', error);
                  }
                } else if ((window as any).dataLayer) {
                  // Fallback via dataLayer
                  (window as any).dataLayer.push({
                    'event': 'conversion',
                    ...conversionParams
                  });
                  console.log('✅ Google Ads: OAuth conversion pushed to dataLayer', {
                    transaction_id: transactionId,
                    has_gclid: !!gclid,
                    has_gclsrc: !!gclsrc
                  });
                }
              };
              
              // If gtag is already loaded, send immediately, otherwise wait
              if ((window as any).gtag) {
                sendConversion();
              } else {
                // Wait up to 3 seconds for gtag to load
                let attempts = 0;
                const checkGtag = setInterval(() => {
                  attempts++;
                  if ((window as any).gtag || attempts > 30) {
                    clearInterval(checkGtag);
                    if ((window as any).gtag) {
                      sendConversion();
                    } else {
                      sendConversion();
                    }
                  }
                }, 100);
              }
              
              // Give time for conversion to be sent before redirect
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Clean up URL - remove token and oauth params
            const cleanUrl = window.location.pathname;
            window.history.replaceState(null, '', cleanUrl);
            
            // Navigate to dashboard after OAuth login
            console.log('🚀 Navigating to dashboard after OAuth login');
            navigateToView("dashboard", true);
            return true;
          } else {
            const errorText = await response.text();
            console.error('❌ OAuth callback failed:', response.status, errorText);
          }
        } catch (error) {
          console.error('❌ OAuth callback error:', error);
        }
      }
      return false;
    };

    // Check for OAuth callback first
    handleOAuthCallback().then((handled) => {
      if (!handled) {
        // If not OAuth callback, check for existing session
        checkSession();
      }
    });

    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cuttech_auth_token' || e.key === 'cuttech_auth_user') {
        checkSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Handle browser back/forward buttons
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state as { view?: View; code?: string; internal?: boolean } | null;
      
      if (state?.internal && state.view) {
        // This is from our internal navigation - restore the view
        setCurrentView(state.view);
        if (state.view === 'stats' && state.code) {
          setSelectedShortCode(state.code);
        } else {
          setSelectedShortCode('');
        }
        setViewHistory(prev => {
          // Remove last entry if going back
          if (prev.length > 0) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } else {
        // No state or external navigation - check URL pathname
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          const urlParams = new URLSearchParams(window.location.search);
          const codeParam = urlParams.get('code');
          
          let viewParam: View | null = null;
          let codeFromPath: string | null = null;
          
          if (pathname === '/dashboard') {
            viewParam = 'dashboard';
          } else if (pathname === '/admin') {
            viewParam = 'admin';
          } else if (pathname === '/settings') {
            viewParam = 'settings';
          } else if (pathname === '/stats' || pathname.startsWith('/stats/')) {
            const statsMatch = pathname.match(/^\/stats\/([^/]+)$/);
            if (statsMatch) {
              // Valid stats URL with code
              viewParam = 'stats';
              codeFromPath = statsMatch[1];
            } else {
              // /stats/ without code - redirect to dashboard (if logged in) or home
              try {
                const storedUser = localStorage.getItem('cuttech_auth_user');
                if (storedUser) {
                  viewParam = 'dashboard';
                } else {
                  viewParam = 'home';
                }
              } catch {
                viewParam = 'home';
              }
              // Clear stats view since we're redirecting
              setSelectedShortCode('');
            }
          } else if (pathname === '/' || pathname === '') {
            viewParam = 'home';
          }
          
          // Fallback to query params for backward compatibility
          if (!viewParam) {
            const viewFromQuery = urlParams.get('view') as View | null;
            if (viewFromQuery && ['home', 'dashboard', 'stats', 'admin', 'settings'].includes(viewFromQuery)) {
              viewParam = viewFromQuery;
            }
          }
          
          if (viewParam && ['home', 'dashboard', 'stats', 'admin', 'settings'].includes(viewParam)) {
            setCurrentView(viewParam);
            const finalCode = codeFromPath || codeParam;
            if (viewParam === 'stats' && finalCode) {
              setSelectedShortCode(finalCode);
            } else {
              setSelectedShortCode('');
            }
          } else {
            setCurrentView("home");
            setViewHistory([]);
          }
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('popstate', handlePopState);
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount to prevent infinite loop

  const checkSession = async () => {
    try {
      // Check for local auth session first
      const { getAuthSession } = await import('./utils/auth');
      const session = getAuthSession();

      if (session) {
        // Get user profile to check admin status
        try {
          const { getApiUrl } = await import('./utils/api/config');
          const response = await fetch(getApiUrl('user/profile'), {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
              setUser({
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                user_metadata: { name: data.user.name },
                access_token: session.access_token,
                is_admin: data.user.is_admin || false,
              });
              setLoading(false);
              return;
            }
          }
        } catch (profileError) {
          console.warn('Failed to fetch user profile, using session data:', profileError);
        }

        // Fallback to session data if profile fetch fails
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          user_metadata: { name: session.user.name },
          access_token: session.access_token,
          is_admin: session.user.is_admin || false, // Use from session if available
        });
        setLoading(false);
        return;
      }

      // Supabase removed - using local auth only

      // No session found
      setUser(null);
    } catch (error) {
      console.error("Session check error:", error);
      setUser(null);
    }

    setLoading(false);
  };

  // Short code redirects are now handled by the server (HTTP 302)
  // No need to handle them in the frontend anymore

  const handleSignOut = async () => {
    const { clearAuthSession } = await import('./utils/auth');
    clearAuthSession();
    setUser(null);
    setCurrentView("home");
  };

  // Function to open modal with URL parameter
  const handleOpenAuthModal = () => {
    setShowAuthModal(true);
    // Add registration parameter to URL without page reload
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('registration', 'true');
      window.history.pushState({}, '', url.toString());
    }
  };

  // Function to close modal and remove parameter from URL
  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    // Remove registration parameter from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('registration');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleAuthSuccess = async () => {
    // Close modal and clear parameter from URL
    handleCloseAuthModal();
    
    // Refresh session to get updated admin status (including is_admin flag)
    await checkSession();
    // Small delay to ensure user state is updated with admin status
    setTimeout(() => {
      // Log user state for debugging
      console.log('🔍 [App] After auth success, user state:', {
        email: user?.email,
        is_admin: user?.is_admin,
        hasUser: !!user,
      });
      // Redirect to dashboard after successful login/registration
      navigateToView("dashboard", true);
    }, 200);
  };

  const handleViewStats = (shortCode: string) => {
    navigateToView("stats", false, shortCode);
  };

  const handleLogoClick = () => {
    setViewHistory([]); // Reset history when clicking logo
    setSelectedShortCode(''); // Clear selected code
    setCurrentView("home"); // Always go to home page
    // Update URL to home page explicitly
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'home', internal: true }, '', '/');
    }
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Handle /r/:code routes - render RedirectPage without changing currentView
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/r/')) {
    return (
      <ErrorBoundary>
        <RedirectPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ContentProvider>
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
          <Header
            user={user}
            dark={dark}
            onToggleDark={toggleDark}
            currentView={currentView}
            onAuthClick={handleOpenAuthModal}
            onSignOut={handleSignOut}
            onLogoClick={handleLogoClick}
            onAdminClick={() => navigateToView("admin")}
            onDashboardClick={() => navigateToView("dashboard")}
            onSettingsClick={() => navigateToView("settings")}
          />

      {currentView === "home" && (
        <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <HomePage
          user={user}
          onAuthRequired={handleOpenAuthModal}
        />
        </Suspense>
      )}

      {currentView === "dashboard" && user && (
        <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <Dashboard
          user={user}
          onViewStats={handleViewStats}
            onSettingsClick={() => navigateToView("settings")}
        />
        </Suspense>
      )}

      {currentView === "stats" && user && selectedShortCode && (
        <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <StatsView
          user={user}
          shortCode={selectedShortCode}
            onBack={navigateBack}
        />
        </Suspense>
      )}

      {currentView === "admin" && user && (
        <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
          <AdminPanel 
            user={user} 
            onViewStats={handleViewStats}
            onBack={navigateBack}
          />
        </Suspense>
      )}

      {currentView === "settings" && user && (
        <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <SettingsPage
          user={user}
            onBack={navigateBack}
        />
        </Suspense>
      )}

      {currentView === "privacy" && (
        <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <PrivacyPolicy />
        </Suspense>
      )}

      {currentView === "terms" && (
        <Suspense fallback={<div className="min-h-[calc(100vh-80px)] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
        <TermsOfService />
        </Suspense>
      )}

      {showAuthModal && (
        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Registration form loading error
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Failed to load the registration form. Please try refreshing the page.
                </p>
                <Button
                  onClick={() => {
                    setShowAuthModal(false);
                    window.location.reload();
                  }}
                  className="w-full"
                >
                  Refresh page
                </Button>
              </div>
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-300">Loading registration form...</p>
                </div>
              </div>
            }
          >
            <AuthModal
              isOpen={showAuthModal}
              onClose={handleCloseAuthModal}
              onSuccess={handleAuthSuccess}
              user={user}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      <Toaster position="top-right" />

      {/* Footer */}
      <footer className="ctt-footer" style={{ marginTop: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 48 }}>
          <div>
            <button onClick={handleLogoClick} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <span className="ctt-logo">
                <span className="ctt-logomark">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 17l-3 3a5 5 0 0 1-7-7l4-4a5 5 0 0 1 7 0"/>
                    <path d="M15 7l3-3a5 5 0 0 1 7 7l-4 4a5 5 0 0 1-7 0"/>
                    <line x1="8" y1="16" x2="16" y2="8"/>
                  </svg>
                </span>
                CutToTech
              </span>
            </button>
            <p style={{ marginTop: 16, fontSize: 14, color: 'var(--text-2)', maxWidth: 320 }}>
              Short links with serious analytics. Built for teams that measure what matters.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Product</div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-2)', listStyle: 'none', padding: 0, margin: 0 }}>
              <li><button onClick={handleLogoClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Features</button></li>
              <li><button onClick={handleOpenAuthModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Get Started</button></li>
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Legal</div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-2)', listStyle: 'none', padding: 0, margin: 0 }}>
              <li><button onClick={() => navigateToView('privacy')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Privacy Policy</button></li>
              <li><button onClick={() => navigateToView('terms')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>Terms of Service</button></li>
            </ul>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '32px auto 0', paddingTop: 24, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
          © {new Date().getFullYear()} CutToTech · All rights reserved
        </div>
      </footer>
      </div>
      </ContentProvider>
    </ErrorBoundary>
  );
}