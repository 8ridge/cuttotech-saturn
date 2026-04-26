import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BarChart, Globe, Zap, MapPin, Users, Mail, Edit, Copy, Check } from './design/icons';
import { MiniBars, MiniWorldMap } from './design/shared';

interface HomePageProps {
  user: { access_token?: string } | null;
  onAuthRequired: () => void;
}

export default function HomePage({ user, onAuthRequired }: HomePageProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fingerprint, setFingerprint] = useState('');

  useEffect(() => {
    // Generate fingerprint for anonymous users (rate limiting)
    const screenWidth = typeof screen !== 'undefined' ? screen.width : 0;
    const screenHeight = typeof screen !== 'undefined' ? screen.height : 0;
    const timestamp = Date.now();
    const performanceTime = typeof performance !== 'undefined' ? Math.floor(performance.now()) : 0;
    const random1 = Math.random().toString(36).substring(2);
    const random2 = Math.random().toString(36).substring(2);
    const random3 = Math.random().toString(36).substring(2);
    const fp = `${navigator.userAgent}-${screenWidth}x${screenHeight}-${navigator.language}-${navigator.platform}-${navigator.hardwareConcurrency || 0}-${navigator.maxTouchPoints || 0}-${timestamp}-${performanceTime}-${random1}-${random2}-${random3}`;
    setFingerprint(btoa(fp).slice(0, 64));
  }, []);

  const handleShorten = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setShortUrl('');

    try {
      const accessToken = user?.access_token;
      const { getTrafficSourceData } = await import('../utils/trafficSource');
      const trafficSource = getTrafficSourceData();
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl('shorten'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken || ''}`,
        },
        body: JSON.stringify({
          url,
          customDomain: null,
          fingerprint: !user ? fingerprint : null,
          utm_source: trafficSource.utm_source || null,
          utm_medium: trafficSource.utm_medium || null,
          utm_campaign: trafficSource.utm_campaign || null,
          utm_content: trafficSource.utm_content || null,
          utm_term: trafficSource.utm_term || null,
          gclid: trafficSource.gclid || null,
          referrer: trafficSource.referrer || null,
        }),
      });

      const contentType = response.headers.get('content-type');
      let data: { shortCode?: string; error?: string; message?: string } = {};
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          try { data = JSON.parse(text); } catch { /* ignore */ }
        }
      }

      if (!response.ok) {
        if (response.status === 403 && (data.error === 'limit_reached' || data.message?.includes('limit'))) {
          onAuthRequired();
          toast.error(t('errors.limitReached'));
        } else {
          toast.error(data.error || data.message || t('errors.shortenError'));
        }
        setLoading(false);
        return;
      }

      // GA4 event
      if (typeof window !== 'undefined') {
        (window as unknown as { dataLayer?: unknown[] }).dataLayer = (window as unknown as { dataLayer?: unknown[] }).dataLayer || [];
        (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
          event: 'link_created',
          user_type: !user ? 'anonymous' : 'authenticated',
          link_creation_source: 'homepage_form',
        });
      }

      setShortUrl(`${window.location.origin}/${data.shortCode}`);
      toast.success(t('success.urlShortened'));
    } catch (err) {
      console.error('Shorten URL error:', err);
      toast.error(t('errors.connectionError'));
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shortUrl);
      } else {
        const ti = document.createElement('input');
        ti.value = shortUrl;
        document.body.appendChild(ti);
        ti.select();
        document.execCommand('copy');
        document.body.removeChild(ti);
      }
      setCopied(true);
      toast.success(t('errors.copiedSuccess'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('errors.copyError'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleShorten();
    }
  };

  return (
    <div style={{ background: 'var(--bg-landing)', minHeight: 'calc(100vh - 64px)' }}>
      {/* Hero */}
      <section style={{ position: 'relative', padding: '80px 32px 96px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 500, height: 500, borderRadius: '50%', background: '#4F46E5', opacity: 0.04, filter: 'blur(60px)' }}/>
        <div style={{ position: 'absolute', bottom: -150, left: -150, width: 400, height: 400, borderRadius: '50%', background: '#7C3AED', opacity: 0.03, filter: 'blur(60px)' }}/>

        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <span className="pill">
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)' }}/>
            {t('hero.badge', 'Free URL Shortener')}
          </span>
          <h1 style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.1, margin: '24px 0 16px', letterSpacing: '-0.03em' }}>
            {t('hero.title', 'Short links, deep insights.')}
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-2)', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.55 }}>
            {t('hero.subtitle', 'Create trackable short links with click analytics, geolocation data, and custom domains.')}
          </p>
        </div>

        {/* Shortener card */}
        <div className="ctt-card" style={{ maxWidth: 560, margin: '0 auto', padding: 16, borderRadius: 18 }}>
          <form onSubmit={handleShorten} style={{ display: 'flex', gap: 8 }}>
            <input
              className="ctt-input"
              type="url"
              style={{ height: 48, flex: 1, borderRadius: 12, fontSize: 15 }}
              placeholder={t('form.urlPlaceholder', 'Paste your link here')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              required
            />
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: 140, height: 48, borderRadius: 12 }}>
              {loading ? t('form.shortening', 'Shortening...') : t('form.shorten', 'Shorten')}
            </button>
          </form>
          {shortUrl && (
            <div className="anim-slide-down" style={{ marginTop: 14, padding: '12px 14px', backgroundColor: 'var(--surface)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--success)' }}/>
              <a href={shortUrl} target="_blank" rel="noopener noreferrer" className="mono" style={{ color: 'var(--accent)', fontSize: 15, flex: 1, textDecoration: 'none' }}>
                {shortUrl}
              </a>
              <button className="btn-icon" type="button" onClick={handleCopy}>
                {copied ? <Check /> : <Copy />}
              </button>
              {copied && <span style={{ fontSize: 12, color: 'var(--success)' }}>{t('form.copied', 'Copied')}</span>}
            </div>
          )}
        </div>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--text-3)' }}>
          {user ? t('form.description.authenticated', 'Unlimited links with detailed analytics') : t('form.description.guest', 'No account needed · 5 free links · Unlimited with signup')}
        </p>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
            {t('features.title', 'Built for marketers who care about data')}
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-2)', marginTop: 8 }}>
            {t('features.subtitle', 'Every click tells a story. We help you read it.')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 16 }}>
          <div className="ctt-card hoverable" style={{ gridRow: 'span 2', padding: 28, backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <BarChart />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>{t('features.analytics.title', 'Real-Time Analytics')}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8, flex: 1 }}>
              {t('features.analytics.desc', 'See every click as it happens. Break down by date, device, browser, and referrer — all in one quiet dashboard.')}
            </p>
            <div style={{ padding: 20, backgroundColor: 'var(--card)', borderRadius: 12, marginTop: 20 }}>
              <MiniBars />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>
          </div>

          <div className="ctt-card hoverable" style={{ padding: 28, backgroundColor: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Globe />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t('features.domains.title', 'Custom Domains')}</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 12 }}>
              {t('features.domains.desc', 'Use your own domain. One-step DNS, automatic SSL.')}
            </p>
            <div className="mono" style={{ marginTop: 16, padding: '10px 14px', backgroundColor: 'var(--card)', borderRadius: 10, fontSize: 14, color: 'var(--accent)' }}>
              yourbrand.co<span style={{ color: 'var(--text-3)' }}>/launch</span>
            </div>
          </div>

          <div className="ctt-card hoverable" style={{ padding: 28, backgroundColor: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Zap />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t('features.instant.title', 'Instant Creation')}</h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 12 }}>
              {t('features.instant.desc', 'Paste, press enter, ship. No sign-up wall for the first five links.')}
            </p>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--success)' }}/>
              {t('features.instant.metric', 'Avg. 84ms to shorten')}
            </div>
          </div>

          <div className="ctt-card hoverable" style={{ gridRow: 'span 2', padding: 28, backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', gridColumn: 2, gridRowStart: 2 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <MapPin />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>{t('features.geo.title', 'Geolocation Tracking')}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8 }}>
              {t('features.geo.desc', 'Country, city, and ISP — for every click. Honor-the-privacy defaults built in.')}
            </p>
            <div style={{ padding: 20, backgroundColor: 'var(--card)', borderRadius: 12, marginTop: 20, flex: 1 }}>
              <MiniWorldMap />
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                <span>🇺🇸 34%</span><span>🇩🇪 22%</span><span>🇯🇵 14%</span><span>🇧🇷 9%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section style={{ padding: '0 32px 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {[
            ['1M+', t('stats.links', 'Links created')],
            ['50K+', t('stats.users', 'Active users')],
            ['10M+', t('stats.clicks', 'Clicks tracked')],
            ['99.9%', t('stats.uptime', 'Uptime')],
          ].map(([n, l], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>{n}</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{l}</div>
              </div>
              {i < 3 && <div style={{ width: 1, height: 40, background: 'var(--border)' }}/>}
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section style={{ padding: '0 32px 96px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 40 }}>
          {t('usecases.title', 'Works everywhere you share links')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { icon: <Users />, title: t('usecases.social.title', 'Social Media'), desc: t('usecases.social.desc', 'Track clicks from every post, story, and bio link. A/B test CTAs across channels.') },
            { icon: <Mail size={20}/>, title: t('usecases.email.title', 'Email Campaigns'), desc: t('usecases.email.desc', 'Per-send UTM in seconds. See who opened, who clicked, and who shared.') },
            { icon: <Edit size={20}/>, title: t('usecases.content.title', 'Content & Blogs'), desc: t('usecases.content.desc', 'Branded links that fit your voice. Swap destinations without touching posts.') },
          ].map((u, i) => (
            <div key={i} className="ctt-card hoverable" style={{ padding: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(79, 70, 229, 0.08)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {u.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 20 }}>{u.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.55 }}>{u.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
