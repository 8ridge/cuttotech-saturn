import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Trash, ArrowLeft } from './design/icons';

interface SettingsPageProps {
  user: { access_token: string };
  onBack: () => void;
}

interface DomainData {
  shortCode: string;
  domain: string;
  originalUrl: string;
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 16px' }}>{desc}</p>
      {children}
    </div>
  );
}

export default function SettingsPage({ user, onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  const [shortCode, setShortCode] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const { getApiUrl } = await import('../utils/api/config');
        const response = await fetch(getApiUrl('user/urls'), {
          headers: { Authorization: `Bearer ${user.access_token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const withDomains = (data.urls || []).filter((u: { customDomain?: string }) => u.customDomain);
          setDomains(withDomains.map((u: { shortCode: string; customDomain: string; originalUrl: string }) => ({
            shortCode: u.shortCode,
            domain: u.customDomain,
            originalUrl: u.originalUrl,
          })));
        }
      } catch (err) {
        console.error('Failed to load domains:', err);
      }
    };
    fetchDomains();
  }, [user.access_token]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortCode.trim() || !domain.trim()) return;
    setLoading(true);
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl('domain/custom'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({ shortCode, domain }),
      });
      if (response.ok) {
        toast.success(t('settings.domainAdded', 'Domain added'));
        setShortCode(''); setDomain('');
        // Reload
        const refreshResponse = await fetch(getApiUrl('user/urls'), {
          headers: { Authorization: `Bearer ${user.access_token}` },
        });
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          const withDomains = (data.urls || []).filter((u: { customDomain?: string }) => u.customDomain);
          setDomains(withDomains.map((u: { shortCode: string; customDomain: string; originalUrl: string }) => ({
            shortCode: u.shortCode,
            domain: u.customDomain,
            originalUrl: u.originalUrl,
          })));
        }
      } else {
        const data = await response.json();
        toast.error(data.error || t('errors.addDomainError', 'Failed to add domain'));
      }
    } catch {
      toast.error(t('errors.connectionError', 'Connection error'));
    }
    setLoading(false);
  };

  const handleRemoveDomain = async (sc: string) => {
    if (!confirm(t('confirm.removeDomain', 'Remove this custom domain?'))) return;
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl('domain/custom'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({ shortCode: sc, domain: '' }),
      });
      if (response.ok) {
        toast.success(t('settings.domainRemoved', 'Domain removed'));
        setDomains(domains.filter(d => d.shortCode !== sc));
      }
    } catch {
      toast.error(t('errors.connectionError', 'Connection error'));
    }
  };

  const handleCopyDNS = () => {
    setCopied('dns');
    navigator.clipboard.writeText('CNAME links cname.cuttotech.com');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div style={{ background: 'var(--bg-app)', minHeight: 'calc(100vh - 64px)' }}>
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '40px 32px 64px' }}>
        <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={onBack}>
          <ArrowLeft /> {t('settings.back', 'Back')}
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          {t('settings.title', 'Settings')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 32px' }}>
          {t('settings.subtitle', 'Manage your domains and DNS configuration.')}
        </p>

        <Section title={t('settings.domains.title', 'Custom Domains')} desc={t('settings.domains.desc', 'Bind your own domains to short codes.')}>
          <div className="ctt-card" style={{ padding: 20 }}>
            <form onSubmit={handleAddDomain} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                  {t('settings.shortCode', 'Short code')}
                </label>
                <input className="ctt-input" style={{ marginTop: 6 }} placeholder="abc123" value={shortCode} onChange={e => setShortCode(e.target.value)} required/>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                  {t('settings.customDomain', 'Custom domain')}
                </label>
                <input className="ctt-input" style={{ marginTop: 6 }} placeholder="links.yourbrand.co" value={domain} onChange={e => setDomain(e.target.value)} required/>
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ alignSelf: 'flex-start', height: 44, padding: '0 18px' }}>
                <Plus /> {loading ? t('settings.adding', 'Adding...') : t('settings.add', 'Add')}
              </button>
            </form>

            {domains.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {domains.map(d => (
                  <div key={d.shortCode} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', backgroundColor: 'var(--surface)', borderRadius: 10 }}>
                    <span className="mono" style={{ flex: 1, fontSize: 14 }}>{d.domain}/{d.shortCode}</span>
                    <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleRemoveDomain(d.shortCode)}>
                      <Trash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title={t('settings.dns.title', 'DNS Configuration')} desc={t('settings.dns.desc', 'Three steps to get your domain live.')}>
          <div style={{ position: 'relative', paddingLeft: 32 }}>
            <div style={{ position: 'absolute', left: 14, top: 14, bottom: 14, width: 2, backgroundColor: 'var(--border)' }}/>
            {[
              {
                title: t('settings.dns.step1', 'Add CNAME Record'),
                body: (
                  <div style={{ background: '#0F172A', borderRadius: 10, padding: 16, fontFamily: 'var(--mono)', fontSize: 13, color: '#E2E8F0', position: 'relative' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: 4 }}>
                      <span style={{ color: '#64748B' }}>Type</span><span>CNAME</span>
                      <span style={{ color: '#64748B' }}>Name</span><span>links</span>
                      <span style={{ color: '#64748B' }}>Value</span><span>cname.cuttotech.com</span>
                    </div>
                    <button onClick={handleCopyDNS} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                      {copied === 'dns' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                ),
              },
              { title: t('settings.dns.step2', 'Wait for DNS Propagation'), body: <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>{t('settings.dns.step2Desc', 'Usually 5–30 minutes. We re-check every minute.')}</p> },
              {
                title: t('settings.dns.step3', 'SSL is automatic'),
                body: (
                  <div>
                    <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 8px' }}>{t('settings.dns.step3Desc', 'We provision SSL certificates automatically once DNS resolves.')}</p>
                  </div>
                ),
              },
            ].map((s, i) => (
              <div key={i} style={{ position: 'relative', marginBottom: 20 }}>
                <div style={{ position: 'absolute', left: -25, top: 2, width: 26, height: 26, borderRadius: '50%', background: 'var(--card)', border: '2px solid var(--accent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{i + 1}</div>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: '2px 0 8px' }}>{s.title}</h4>
                {s.body}
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
