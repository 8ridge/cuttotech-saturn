import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BarChart, Globe, Zap, ArrowLeft, Chevron, Users } from './design/icons';
import { StatCard, LineChart, DonutChart, ProgressBar } from './design/shared';

interface StatsViewProps {
  user: { access_token: string };
  shortCode: string;
  onBack: () => void;
}

interface StatItem {
  country: string;
  device?: string;
  city?: string;
  userAgent?: string;
  timestamp: string;
  ip?: string;
}

interface StatsData {
  shortCode: string;
  originalUrl: string;
  createdAt: string;
  totalClicks: number;
  stats: StatItem[];
}

export default function StatsView({ user, shortCode, onBack }: StatsViewProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (!shortCode || !user?.access_token) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode, user?.access_token]);

  const loadStats = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { getApiUrl } = await import('../utils/api/config');
      const response = await fetch(getApiUrl(`api/stats/${shortCode}`), {
        headers: { Authorization: `Bearer ${user.access_token}` },
      });
      const result = await response.json();
      if (response.ok) setData(result);
      else toast.error(t('errors.statsLoadError', 'Failed to load statistics'));
    } catch (err) {
      console.error('Stats load error:', err);
      toast.error(t('errors.connectionError', 'Connection error'));
    }
    setLoading(false);
    loadingRef.current = false;
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
          <p style={{ fontSize: 14, color: 'var(--text-2)' }}>{t('stats.loading', 'Loading statistics...')}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: 'var(--bg-app)', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, color: 'var(--text-2)' }}>{t('stats.notFound', 'Statistics not found')}</p>
          <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onBack}>
            <ArrowLeft /> {t('stats.back', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  // Process stats
  const countryStats: Record<string, number> = {};
  const deviceMap: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
  const uniqueIPs = new Set<string>();

  data.stats.forEach(s => {
    countryStats[s.country] = (countryStats[s.country] || 0) + 1;
    if (s.ip) uniqueIPs.add(s.ip);
    const ua = (s.userAgent || s.device || '').toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) deviceMap.Mobile++;
    else if (ua.includes('tablet') || ua.includes('ipad')) deviceMap.Tablet++;
    else deviceMap.Desktop++;
  });

  const topCountries = Object.entries(countryStats).sort(([,a], [,b]) => b - a).slice(0, 7);
  const maxCountryClicks = topCountries[0]?.[1] || 1;

  const totalD = deviceMap.Desktop + deviceMap.Mobile + deviceMap.Tablet || 1;
  const devices = [
    { name: 'Desktop', pct: Math.round(deviceMap.Desktop / totalD * 100), color: '#4F46E5' },
    { name: 'Mobile', pct: Math.round(deviceMap.Mobile / totalD * 100), color: '#A855F7' },
    { name: 'Tablet', pct: Math.round(deviceMap.Tablet / totalD * 100), color: '#94A3B8' },
  ];

  const now = Date.now();
  const days = period === '7' ? 7 : period === '30' ? 30 : 60;
  const chartData = Array.from({ length: days }, (_, i) => {
    const date = new Date(now - (days - 1 - i) * 86400000);
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = data.stats.filter(s => new Date(s.timestamp).toDateString() === date.toDateString()).length;
    return { l: label, v: count };
  });

  const daysAgo = Math.floor((now - new Date(data.createdAt).getTime()) / 86400000);
  const recentClicks = [...data.stats].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

  return (
    <div style={{ background: 'var(--bg-app)', minHeight: 'calc(100vh - 64px)' }}>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 48px' }}>
        <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={onBack}>
          <ArrowLeft /> {t('stats.backToLinks', 'Back to links')}
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 22, color: 'var(--accent)', fontWeight: 500 }}>/{data.shortCode}</span>
          <span style={{ fontSize: 14, color: 'var(--text-2)', maxWidth: 540, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {data.originalUrl}</span>
          <span className="pill" style={{ height: 24, fontSize: 12 }}>
            {t('stats.created', 'Created')} {new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 24, marginBottom: 24 }}>
          <StatCard value={data.totalClicks.toLocaleString()} label={t('stats.totalClicks', 'Total clicks')} icon={<BarChart size={20}/>} color="#4F46E5"/>
          <StatCard value={uniqueIPs.size.toLocaleString()} label={t('stats.uniqueVisitors', 'Unique visitors')} icon={<Users size={20}/>} color="#16A34A"/>
          <StatCard value={Object.keys(countryStats).length.toString()} label={t('stats.countries', 'Countries')} icon={<Globe size={20}/>} color="#A855F7"/>
          <StatCard value={daysAgo + 'd'} label={t('stats.age', 'Age')} icon={<Zap size={20}/>} color="#D97706"/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="ctt-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t('stats.clicksOverTime', 'Clicks over time')}</h3>
              <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--surface)', padding: 4, borderRadius: 10 }}>
                {([['7', '7 days'], ['30', '30 days'], ['all', 'All time']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setPeriod(v as '7' | '30' | 'all')} style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                    backgroundColor: period === v ? 'var(--card)' : 'transparent',
                    color: period === v ? 'var(--text-1)' : 'var(--text-2)',
                    boxShadow: period === v ? 'var(--shadow-sm)' : 'none',
                    border: 'none', cursor: 'pointer',
                  }}>{l}</button>
                ))}
              </div>
            </div>
            <LineChart data={chartData}/>
          </div>
          <div className="ctt-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>{t('stats.devices', 'Devices')}</h3>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DonutChart segments={devices} total={data.totalClicks}/>
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {devices.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }}/>
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ color: 'var(--text-2)' }}>{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="ctt-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>{t('stats.topCountries', 'Top countries')}</h3>
            {topCountries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topCountries.map(([country, count]) => (
                  <div key={country} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                    <span style={{ width: 140 }}>{country}</span>
                    <ProgressBar pct={Math.round(count / maxCountryClicks * 100)}/>
                    <span style={{ width: 44, textAlign: 'right', fontWeight: 600 }}>{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>{t('stats.noGeoData', 'No geographic data yet')}</p>
            )}
          </div>
          <div className="ctt-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>{t('stats.recentClicks', 'Recent clicks')}</h3>
            {recentClicks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentClicks.slice(0, 5).map((click, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-3)', width: 80 }}>
                      {new Date(click.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ flex: 1 }}>{click.city || click.country}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-3)', textAlign: 'center', padding: 24 }}>{t('stats.noClicks', 'No clicks yet')}</p>
            )}
          </div>
        </div>

        <div className="ctt-card" style={{ padding: showLog ? 24 : '14px 24px' }}>
          <button onClick={() => setShowLog(!showLog)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-1)' }}>
            <Chevron size={14} style={{ transform: showLog ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' } as React.CSSProperties}/>
            {t('stats.showLog', 'Show detailed log')}
          </button>
          {showLog && (
            <div className="anim-slide-down" style={{ marginTop: 16 }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-3)', fontWeight: 500, fontSize: 12 }}>
                    <th style={{ padding: '8px 12px' }}>{t('stats.time', 'Time')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('stats.location', 'Location')}</th>
                    <th style={{ padding: '8px 12px' }}>{t('stats.ip', 'IP')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClicks.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 ? 'var(--surface)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>{new Date(r.timestamp).toLocaleString('en-US')}</td>
                      <td style={{ padding: '10px 12px' }}>{r.city ? `${r.city}, ${r.country}` : r.country}</td>
                      <td style={{ padding: '10px 12px' }} className="mono">{r.ip || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentClicks.length === 0 && <p style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: 14 }}>{t('stats.noClicks', 'No clicks yet')}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
