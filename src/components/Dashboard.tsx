import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Link as LinkIcon, BarChart, Copy, Check, Plus, Search, Stats, QR, Chevron, Trash, X } from './design/icons';
import { StatCard, Sparkline, LiveActivity } from './design/shared';

interface DashboardProps {
  user: { access_token: string; id?: string; email?: string };
  onViewStats: (shortCode: string) => void;
  onSettingsClick?: () => void;
}

interface UrlData {
  shortCode: string;
  originalUrl: string;
  createdAt: string;
  clicks: number;
  customDomain?: string;
}

export default function Dashboard({ user, onViewStats }: DashboardProps) {
  const { t } = useTranslation();
  const [urls, setUrls] = useState<UrlData[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    if (user?.access_token && !loadingRef.current) {
      loadUrls();
    }
  }, [user?.access_token]);

  const loadUrls = async () => {
    if (!user?.access_token || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl('user/urls'), {
        headers: { Authorization: `Bearer ${user.access_token}` },
      });
      const data = await response.json();
      if (response.ok) setUrls(data.urls || []);
      else toast.error(t('errors.loadError', 'Failed to load links'));
    } catch (err) {
      console.error('Load URLs error:', err);
      toast.error(t('errors.connectionError', 'Connection error'));
    }
    setLoading(false);
    loadingRef.current = false;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl('shorten'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          url: newUrl,
          shortCode: newAlias || undefined, // Backend uses 'shortCode' field for custom alias
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(t('success.linkCreated', 'Link created'));
        setNewUrl(''); setNewAlias('');
        setExpanded(false); setShowAdvanced(false);
        loadUrls();
      } else {
        toast.error(data.error || data.message || t('errors.createError', 'Failed to create'));
      }
    } catch (err) {
      console.error('Create URL error:', err);
      toast.error(t('errors.connectionError', 'Connection error'));
    }
    setCreating(false);
  };

  const handleDelete = async (shortCode: string) => {
    if (!confirm(t('confirm.deleteLink', 'Delete this link?'))) return;
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl(`url/${shortCode}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.access_token}` },
      });
      if (response.ok) {
        toast.success(t('success.linkDeleted', 'Link deleted'));
        loadUrls();
      } else toast.error(t('errors.deleteError', 'Failed to delete'));
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('errors.connectionError', 'Connection error'));
    }
  };

  const handleCopy = async (shortCode: string, customDomain?: string) => {
    const baseUrl = customDomain ? `https://${customDomain}` : window.location.origin;
    const fullUrl = `${baseUrl}/${shortCode}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        const ti = document.createElement('input');
        ti.value = fullUrl;
        document.body.appendChild(ti);
        ti.select();
        document.execCommand('copy');
        document.body.removeChild(ti);
      }
      setCopiedCode(shortCode);
      toast.success(t('success.copied', 'Copied to clipboard'));
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      toast.error(t('errors.copyError', 'Copy failed'));
    }
  };

  const totalClicks = urls.reduce((s, u) => s + u.clicks, 0);
  const avgClicks = urls.length > 0 ? totalClicks / urls.length : 0;
  const filtered = urls.filter(l => !search || l.shortCode.toLowerCase().includes(search.toLowerCase()) || l.originalUrl.toLowerCase().includes(search.toLowerCase()));
  const sparkData = (clicks: number) => Array.from({ length: 7 }, (_, i) => Math.max(1, Math.round(clicks / 7 * (0.5 + Math.sin(i * 1.2) * 0.5))));

  return (
    <div style={{ background: 'var(--bg-app)', minHeight: 'calc(100vh - 64px)' }}>
      {/* QR Code modal */}
      {qrCode && (
        <div onClick={() => setQrCode(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} className="ctt-card" style={{ padding: 32, textAlign: 'center', maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>QR Code</h3>
              <button className="btn-icon" onClick={() => setQrCode(null)}><X /></button>
            </div>
            <div style={{ background: '#fff', padding: 20, borderRadius: 12, display: 'inline-block' }}>
              <QRCodeSVG value={qrCode} size={200} level="H" />
            </div>
            <p className="mono" style={{ marginTop: 16, fontSize: 13, color: 'var(--text-2)', wordBreak: 'break-all' }}>{qrCode}</p>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
        <div className="anim-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
            {t('dashboard.title', 'Your Links')}
          </h1>
          <button className="btn btn-primary sm" onClick={() => setExpanded(!expanded)}>
            <Plus /> {t('dashboard.newLink', 'New Link')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard value={urls.length} label={t('dashboard.totalLinks', 'Total links')} icon={<LinkIcon size={20}/>} color="#4F46E5" delay={0} animated />
          <StatCard value={totalClicks} label={t('dashboard.totalClicks', 'Total clicks')} icon={<BarChart size={20}/>} color="#16A34A" delay={80} animated />
          <StatCard value={avgClicks.toFixed(1)} label={t('dashboard.avgClicks', 'Avg. clicks')} icon={<Stats size={20}/>} color="#A855F7" delay={160} />
          <div className="anim-slide-up" style={{ animationDelay: '240ms' }}><LiveActivity accessToken={user.access_token} /></div>
        </div>

        {expanded && (
          <div className="ctt-card anim-slide-down" style={{ padding: 24, marginBottom: 16 }}>
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
              <input className="ctt-input" style={{ flex: 1 }} placeholder="https://your-long-url.com/path" value={newUrl} onChange={e => setNewUrl(e.target.value)} required />
              <button className="btn btn-primary" type="submit" disabled={creating} style={{ width: 120 }}>
                {creating ? t('form.creating', 'Creating...') : t('form.shorten', 'Shorten')}
              </button>
            </form>
            <button onClick={() => setShowAdvanced(!showAdvanced)} type="button" style={{ marginTop: 16, fontSize: 13, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
              <Chevron size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' } as React.CSSProperties}/>
              {t('form.advanced', 'Advanced options')}
            </button>
            {showAdvanced && (
              <div className="anim-slide-down" style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                  {t('form.customAlias', 'Custom alias')}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, border: '1px solid var(--border)', borderRadius: 10, backgroundColor: 'var(--card)' }}>
                  <span className="mono" style={{ padding: '0 12px', color: 'var(--text-3)' }}>/</span>
                  <input style={{ flex: 1, height: 40, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-1)', fontFamily: 'inherit' }} placeholder="my-alias" value={newAlias} onChange={e => setNewAlias(e.target.value)}/>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="anim-slide-up" style={{ animationDelay: '320ms', position: 'relative', marginBottom: 16 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}/>
          <input className="ctt-input" style={{ height: 40, paddingLeft: 40 }} placeholder={t('form.searchLinks', 'Search links...')} value={search} onChange={e => setSearch(e.target.value)}/>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }}/>)}
          </div>
        ) : filtered.length === 0 && !search ? (
          <div className="anim-scale-in" style={{ padding: '80px 32px', background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 16, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 20, background: 'var(--surface)', color: 'var(--text-3)', marginBottom: 20 }}>
              <LinkIcon size={32}/>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 6px' }}>{t('dashboard.noLinks', 'No links yet')}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px' }}>
              {t('dashboard.noLinksDesc', "Start with your first one — paste a URL and we'll shorten it.")}
            </p>
            <button className="btn btn-secondary" style={{ height: 40, padding: '0 18px' }} onClick={() => setExpanded(true)}>
              <Plus /> {t('dashboard.firstLink', 'Create your first link')}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((link, i) => {
              const fullUrl = `${link.customDomain ? `https://${link.customDomain}` : window.location.origin}/${link.shortCode}`;
              return (
                <div key={link.shortCode} className="link-row anim-slide-up" style={{ animationDelay: (i * 50) + 'ms' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent)', flexShrink: 0 }}/>
                  <span className="mono" style={{ color: 'var(--accent)', fontSize: 15, width: 140, flexShrink: 0 }}>/{link.shortCode}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.originalUrl}</span>
                  <Sparkline data={sparkData(link.clicks)} delay={i * 50 + 300}/>
                  <span style={{ fontSize: 14, fontWeight: 600, width: 90, textAlign: 'right' }}>
                    {link.clicks.toLocaleString()} <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12 }}>{t('dashboard.clicks', 'clicks')}</span>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', width: 100, textAlign: 'right' }}>
                    {new Date(link.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="btn-icon" onClick={() => handleCopy(link.shortCode, link.customDomain)} title="Copy">
                      {copiedCode === link.shortCode ? <Check /> : <Copy />}
                    </button>
                    <button className="btn-icon" onClick={() => setQrCode(fullUrl)} title="QR code"><QR /></button>
                    <button className="btn-icon" onClick={() => onViewStats(link.shortCode)} title="Stats"><Stats /></button>
                    <button className="btn-icon" onClick={() => handleDelete(link.shortCode)} style={{ color: 'var(--danger)' }} title="Delete"><Trash /></button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && search && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
                {t('dashboard.noMatch', 'No links match')} "{search}"
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
