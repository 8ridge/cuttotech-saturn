import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface ContentMap {
  [key: string]: string;
}

interface ContentContextType {
  content: ContentMap;
  loading: boolean;
  error: string | null;
  refreshContent: () => Promise<void>;
  getText: (key: string, fallback?: string) => string;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

// Fallback content in case Supabase is not configured or table doesn't exist
const fallbackContent: ContentMap = {
  // Home page
  'home.hero.badge': 'Modern URL shortening service',
  'home.hero.title': 'Transform long links into powerful marketing tools',
  'home.hero.subtitle': 'Create short links, track every click, and make data-driven decisions',
  'home.hero.card.title': 'Create a short link right now',
  'home.hero.card.description.auth': '✨ Unlimited links with advanced analytics',
  'home.hero.card.description.guest': '🚀 5 free links without registration',
  'home.hero.url.placeholder': 'https://example.com/very/long/url/that/needs/to/be/shortened',
  'home.hero.domain.placeholder': 'Custom domain (optional): link.mysite.com',
  'home.hero.button': 'Shorten link',
  'home.hero.button.loading': 'Creating...',
  'home.hero.success': 'Link created successfully!',
  
  // Why choose us
  'home.why.title': 'Why choose our service?',
  'home.why.subtitle': 'We offer more than just URL shortening',
  'home.why.analytics.title': 'Detailed analytics',
  'home.why.analytics.description': 'Track every click with information about geolocation, devices, browsers, and traffic sources',
  'home.why.domains.title': 'Custom domains',
  'home.why.domains.description': 'Use your own domain to build trust and brand recognition',
  'home.why.security.title': 'Security',
  'home.why.security.description': 'Your data is protected with modern encryption technologies and secure storage',
  
  // Benefits
  'home.benefits.title': 'Benefits for your business',
  'home.benefits.subtitle': 'Increase conversion and optimize marketing campaigns',
  'home.benefits.ctr.title': 'Increase CTR by 30%',
  'home.benefits.ctr.description': 'Short links look professional and inspire more trust from users, leading to higher click-through rates',
  'home.benefits.audience.title': 'Understand your audience',
  'home.benefits.audience.description': 'Get detailed information about each visitor: where they came from, what device they use, and which country they are in',
  'home.benefits.instant.title': 'Instant creation',
  'home.benefits.instant.description': 'Create short links in seconds without registration. Register for free to access advanced features',
  'home.benefits.brand.title': 'Strengthen your brand',
  'home.benefits.brand.description': 'Use custom domains to create recognizable links that match your brand',
  
  // Use cases
  'home.usecases.title': 'Perfect for any task',
  'home.usecases.subtitle': 'From personal projects to enterprise solutions',
  'home.usecases.social.title': 'Social media',
  'home.usecases.social.description': 'Optimize posts on Instagram, Twitter, Facebook, and other social networks',
  'home.usecases.email.title': 'Email marketing',
  'home.usecases.email.description': 'Track email campaign effectiveness with precise analytics',
  'home.usecases.content.title': 'Content marketing',
  'home.usecases.content.description': 'Share content with beautiful short links and monitor engagement',
  
  // CTA
  'home.cta.title': 'Ready to get started?',
  'home.cta.subtitle': 'Sign up for free and get access to all platform features',
  'home.cta.button.primary': 'Start for free',
  'home.cta.button.secondary': 'View demo',
  'home.cta.note': 'No credit card required • Setup in 2 minutes • Cancel anytime',
  
  // Stats
  'home.stats.links': '1M+',
  'home.stats.links.label': 'Links created',
  'home.stats.users': '50K+',
  'home.stats.users.label': 'Active users',
  'home.stats.clicks': '10M+',
  'home.stats.clicks.label': 'Clicks tracked',
  'home.stats.uptime': '99.9%',
  'home.stats.uptime.label': 'Uptime',
  
  // Header
  'header.logo': 'CutToTech',
  'header.logoIcon': 'link',
  'header.login': 'Login / Sign up',
  'header.logout': 'Logout',
  
  // Auth
  'auth.title': 'Join ShortURL',
  'auth.subtitle': 'Get access to all platform features',
  'auth.benefits.title': 'Account benefits',
  'auth.benefits.links': 'Unlimited links',
  'auth.benefits.analytics': 'Detailed analytics and statistics',
  'auth.benefits.domains': 'Custom domains',
  'auth.benefits.geo': 'Visitor geolocation',
  'auth.benefits.history': 'Full click history',
  'auth.benefits.support': 'Priority support',
  'auth.free.title': '100% Free',
  'auth.free.description': 'No hidden fees. All features are free forever.',
  'auth.login.tab': 'Login',
  'auth.signup.tab': 'Sign up',
  'auth.email.label': 'Email',
  'auth.password.label': 'Password',
  'auth.name.label': 'Name',
  'auth.login.button': 'Login',
  'auth.signup.button': 'Sign up for free',
  'auth.social.divider': 'Or sign in with',
  
  // Dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'Manage your links and track statistics',
  'dashboard.settings': 'Domain settings',
  'dashboard.stats.links': 'Total links',
  'dashboard.stats.links.note': 'Unlimited',
  'dashboard.stats.clicks': 'Total clicks',
  'dashboard.stats.clicks.note': 'All time',
  'dashboard.stats.ctr': 'Average CTR',
  'dashboard.stats.ctr.note': 'Clicks per link',
  'dashboard.links.title': 'My links',
  'dashboard.links.create': 'Create link',
  'dashboard.links.empty': 'You don\'t have any shortened links yet',
  'dashboard.links.create.first': 'Create your first link',
  
  // Admin (keep in Russian as requested)
  'admin.title': 'Административная панель',
  'admin.subtitle': 'Управление всеми ссылками в системе',
  'admin.total': 'Всего ссылок:',
  'admin.refresh': 'Обновить',
  'admin.content.title': 'Управление контентом',
  'admin.content.subtitle': 'Редактируйте тексты на сайте',
};

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ContentMap>(fallbackContent);
  const [loading, setLoading] = useState(false); // Start with false - don't block UI
  const [error, setError] = useState<string | null>(null);

  const loadContent = async () => {
    try {
      // Try to load content from our API (no auth required for public content)
      const { getApiUrl } = await import('./api/config');
      const response = await fetch(getApiUrl('admin/content'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.content && result.content.length > 0) {
          const contentMap: ContentMap = {};
          result.content.forEach((item: any) => {
            contentMap[item.key] = item.value;
          });
          // Merge with fallback to ensure all keys exist
          setContent({ ...fallbackContent, ...contentMap });
          setError(null);
          return;
        }
      }

      // If API fails or returns no content, use fallback (silently)
      setContent(fallbackContent);
      setError(null);
    } catch (err) {
      // Silently use fallback content on error
      setContent(fallbackContent);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load content in background, don't block UI
    // Start with fallback content immediately
    loadContent();
  }, []);

  const refreshContent = async () => {
    setLoading(true);
    await loadContent();
  };

  const getText = (key: string, fallback?: string): string => {
    return content[key] || fallback || key;
  };

  return (
    <ContentContext.Provider value={{ content, loading, error, refreshContent, getText }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const context = useContext(ContentContext);
  if (context === undefined) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
}

// Helper hook for easy text retrieval
export function useText(key: string, fallback?: string): string {
  const { getText } = useContent();
  return getText(key, fallback);
}
