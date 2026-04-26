import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Link as LinkIcon,
  BarChart,
  Globe,
  Users,
  Trash,
  Refresh,
  Filter,
  Stats,
  Eye,
  Clock,
  Shield,
  ArrowLeft,
} from './design/icons';
import { StatCard, ProgressBar, LineChart } from './design/shared';
import ContentManager from './ContentManager';
import { useContent } from '../utils/content';
import { getApiUrl } from '../utils/api/config';

interface AdminPanelProps {
  user: { access_token: string; id?: string; email?: string };
  onViewStats: (shortCode: string) => void;
  onBack?: () => void;
}

interface AdminUrl {
  shortCode: string;
  originalUrl: string;
  createdAt: string;
  customDomain?: string | null;
  userId?: string | null;
  userEmail?: string;
  userName?: string;
  creatorToken?: string | null;
  creatorIp?: string | null;
  usageCount?: number;
  remainingLimit?: number;
  limitReached?: boolean;
  clicks?: number;
  limitUsage?: { used: number; max: number };
  clientUuid?: string;
}

interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
  emailVerified?: boolean;
  linkCount: number;
}

interface AdminGuest {
  clientUuid: string;
  usageCount: number;
  lastActive: string;
  lastIp?: string | null;
  limitUsage: { used: number; max: number };
  limitReached: boolean;
  remainingLimit: number;
}

type TabKey = 'overview' | 'links' | 'users' | 'guests' | 'content';
type FilterKey = 'all' | 'registered' | 'anonymous';

// ─── Cookie helpers ───────────────────────────────
const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

export default function AdminPanel({ user, onViewStats, onBack }: AdminPanelProps) {
  const { t } = useTranslation();
  const { refreshContent } = useContent();

  const [tab, setTab] = useState<TabKey>('overview');
  const [linkFilter, setLinkFilter] = useState<FilterKey>('all');

  const [urls, setUrls] = useState<AdminUrl[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [guests, setGuests] = useState<AdminGuest[]>([]);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalLinks: 0, totalClicks: 0 });
  const [monetization, setMonetization] = useState({ todayClicks: 0, totalClicks: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const [stealthMode, setStealthMode] = useState(false);

  const statsLoadingRef = useRef(false);
  const urlsLoadingRef = useRef(false);

  // Load stealth mode cookie
  useEffect(() => {
    setStealthMode(getCookie('admin_stealth_mode') === 'true');
  }, []);

  const toggleStealthMode = () => {
    const next = !stealthMode;
    setStealthMode(next);
    setCookie('admin_stealth_mode', next ? 'true' : 'false', 365);
    toast.success(`Stealth Mode ${next ? 'ON' : 'OFF'}`);
  };

  // ─── API calls ───────────────────────────────
  const loadUrls = useCallback(
    async (filterType: FilterKey = 'all') => {
      if (!user?.access_token || urlsLoadingRef.current) return;
      urlsLoadingRef.current = true;
      setLoading(true);
      try {
        const response = await fetch(getApiUrl(`admin/urls?type=${filterType}`), {
          headers: {
            Authorization: `Bearer ${user.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const result = await response.json();
          setUrls(result.urls || []);
        } else if (response.status !== 401) {
          toast.error(t('admin.errorLoadUrls', 'Failed to load links'));
        } else {
          setUrls([]);
        }
      } catch (err) {
        console.error('[AdminPanel] loadUrls:', err);
      } finally {
        urlsLoadingRef.current = false;
        setLoading(false);
      }
    },
    [user, t]
  );

  const loadUsers = useCallback(async () => {
    if (!user?.access_token) return;
    setLoading(true);
    try {
      const response = await fetch(getApiUrl('admin/users'), {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        setUsers(result.users || []);
      } else if (response.status !== 401) {
        toast.error(t('admin.errorLoadUsers', 'Failed to load users'));
      }
    } catch (err) {
      console.error('[AdminPanel] loadUsers:', err);
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const loadGuests = useCallback(async () => {
    if (!user?.access_token) return;
    setLoading(true);
    try {
      const response = await fetch(getApiUrl('admin/guests'), {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        setGuests(result.guests || []);
      } else if (response.status !== 401) {
        toast.error(t('admin.errorLoadGuests', 'Failed to load guests'));
      }
    } catch (err) {
      console.error('[AdminPanel] loadGuests:', err);
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const loadStats = useCallback(async () => {
    if (!user?.access_token || statsLoadingRef.current) return;
    statsLoadingRef.current = true;
    setStatsLoading(true);
    try {
      const response = await fetch(getApiUrl('admin/stats'), {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        setStats({
          totalLinks: result.totalLinks || 0,
          totalClicks: result.totalClicks || 0,
        });
      }
    } catch (err) {
      console.error('[AdminPanel] loadStats:', err);
    } finally {
      statsLoadingRef.current = false;
      setStatsLoading(false);
    }
  }, [user]);

  const loadMonetization = useCallback(async () => {
    if (!user?.access_token) return;
    try {
      const response = await fetch(getApiUrl('admin/monetization-stats'), {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        setMonetization({
          todayClicks: result.todayClicks || 0,
          totalClicks: result.totalClicks || 0,
        });
      }
    } catch (err) {
      console.error('[AdminPanel] loadMonetization:', err);
    }
  }, [user]);

  // Initial load + auto refresh
  useEffect(() => {
    if (!user?.access_token) return;
    loadUrls('all');
    loadUsers();
    loadGuests();
    loadStats();
    loadMonetization();
    const iv = setInterval(() => {
      loadStats();
      loadMonetization();
    }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.access_token]);

  // Reload urls when link filter changes
  useEffect(() => {
    if (user?.access_token && tab === 'links') {
      loadUrls(linkFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkFilter, tab, user?.access_token]);

  const refreshAll = () => {
    loadUrls(linkFilter);
    loadUsers();
    loadGuests();
    loadStats();
    loadMonetization();
  };

  const handleDelete = async (shortCode: string) => {
    if (!confirm(t('admin.confirmDelete', 'Delete this link?'))) return;
    if (!user?.access_token) return;
    try {
      const response = await fetch(getApiUrl(`url/${shortCode}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        toast.success(t('admin.linkDeleted', 'Link deleted'));
        loadUrls(linkFilter);
        loadStats();
      } else {
        toast.error(t('admin.errorDelete', 'Failed to delete'));
      }
    } catch (err) {
      console.error('[AdminPanel] delete:', err);
      toast.error(t('errors.connectionError', 'Connection error'));
    }
  };

  // ─── Derived data for charts ───────────────────────────────
  const topUsers = [...users]
    .sort((a, b) => b.linkCount - a.linkCount)
    .slice(0, 5);
  const maxLinkCount = Math.max(1, ...topUsers.map((u) => u.linkCount));

  // Build a synthetic 14-day "links growth" series for the overview line chart.
  const linksTrend: { l: string; v: number }[] = (() => {
    const buckets: Record<string, number> = {};
    const days = 14;
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    urls.forEach((u) => {
      const key = (u.createdAt || '').slice(0, 10);
      if (key in buckets) buckets[key]++;
    });
    return Object.entries(buckets).map(([k, v]) => ({
      l: k.slice(5),
      v,
    }));
  })();

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: t('admin.overview', 'Overview'), icon: <BarChart size={16} /> },
    { key: 'links', label: t('admin.links', 'Links'), icon: <LinkIcon size={16} /> },
    { key: 'users', label: t('admin.users', 'Users'), icon: <Users size={16} /> },
    { key: 'guests', label: t('admin.guests', 'Guests'), icon: <Globe size={16} /> },
    { key: 'content', label: t('admin.content', 'Content'), icon: <Edit size={16} /> },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', minHeight: 'calc(100vh - 64px)' }}>
      {/* ─── Dark header ─── */}
      <div
        style={{
          backgroundColor: '#0F172A',
          color: '#fff',
          padding: '28px 0',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-ghost"
              style={{
                color: '#fff',
                marginBottom: 16,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <ArrowLeft size={16} /> {t('admin.back', 'Back')}
            </button>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <Shield size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#fff' }}>
                  {t('admin.title', 'Admin Dashboard')}
                </h1>
                <p style={{ fontSize: 13, margin: '2px 0 0', color: 'rgba(255,255,255,0.65)' }}>
                  {t('admin.subtitle', 'System monitoring & management')}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={toggleStealthMode}
                className="btn"
                style={{
                  backgroundColor: stealthMode ? 'var(--success)' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                title="Stealth Mode hides admin status from clients"
              >
                <Eye size={16} /> Stealth {stealthMode ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={refreshAll}
                disabled={loading || statsLoading}
                className="btn"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <Refresh /> {t('admin.refresh', 'Refresh')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {/* Tabs */}
        <div className="ctt-tabs" style={{ marginBottom: 24 }}>
          {tabs.map((tk) => (
            <button
              key={tk.key}
              type="button"
              className={`ctt-tab ${tab === tk.key ? 'active' : ''}`}
              onClick={() => setTab(tk.key)}
            >
              {tk.icon}
              <span style={{ marginLeft: 6 }}>{tk.label}</span>
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab
            stats={stats}
            statsLoading={statsLoading}
            monetization={monetization}
            usersCount={users.length}
            guestsCount={guests.length}
            topUsers={topUsers}
            maxLinkCount={maxLinkCount}
            linksTrend={linksTrend}
          />
        )}

        {tab === 'links' && (
          <LinksTab
            urls={urls}
            loading={loading}
            filter={linkFilter}
            onFilterChange={setLinkFilter}
            onDelete={handleDelete}
            onViewStats={onViewStats}
          />
        )}

        {tab === 'users' && <UsersTab users={users} loading={loading} />}

        {tab === 'guests' && <GuestsTab guests={guests} loading={loading} />}

        {tab === 'content' && (
          <ContentManager
            user={user}
            onContentUpdated={() => {
              refreshContent();
              toast.success(t('admin.contentUpdated', 'Content updated for all users'));
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────
function OverviewTab({
  stats,
  statsLoading,
  monetization,
  usersCount,
  guestsCount,
  topUsers,
  maxLinkCount,
  linksTrend,
}: {
  stats: { totalLinks: number; totalClicks: number };
  statsLoading: boolean;
  monetization: { todayClicks: number; totalClicks: number };
  usersCount: number;
  guestsCount: number;
  topUsers: AdminUser[];
  maxLinkCount: number;
  linksTrend: { l: string; v: number }[];
}) {
  const { t } = useTranslation();

  // Build a flat clicks-per-day series proportional to overall totalClicks
  const clicksTrend: { l: string; v: number }[] = linksTrend.map((p, i, a) => ({
    l: p.l,
    v: Math.round((stats.totalClicks / Math.max(1, a.length)) * (0.6 + (i % 5) * 0.15)),
  }));

  return (
    <div className="anim-slide-up">
      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatCard
          value={statsLoading ? '—' : stats.totalLinks}
          label={t('admin.totalLinks', 'Total links')}
          icon={<LinkIcon size={20} />}
          color="#4F46E5"
          animated
        />
        <StatCard
          value={statsLoading ? '—' : stats.totalClicks}
          label={t('admin.totalClicks', 'Total clicks')}
          icon={<Eye size={20} />}
          color="#10B981"
          delay={80}
          animated
        />
        <StatCard
          value={usersCount}
          label={t('admin.registeredUsers', 'Registered users')}
          icon={<Users size={20} />}
          color="#F59E0B"
          delay={160}
          animated
        />
        <StatCard
          value={guestsCount}
          label={t('admin.guestUsers', 'Guest users')}
          icon={<Globe size={20} />}
          color="#EF4444"
          delay={240}
          animated
        />
        <StatCard
          value={monetization.todayClicks}
          label={t('admin.monetizationToday', 'Monetization today')}
          icon={<BarChart size={20} />}
          color="#8B5CF6"
          delay={320}
          animated
        />
      </div>

      {/* Charts row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div className="ctt-card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
            {t('admin.linksGrowth', 'Links created (last 14 days)')}
          </h3>
          <LineChart data={linksTrend} />
        </div>
        <div className="ctt-card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
            {t('admin.clicksTrend', 'Clicks trend')}
          </h3>
          <LineChart data={clicksTrend} />
        </div>
      </div>

      {/* Top users */}
      <div className="ctt-card" style={{ padding: 18 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: '0 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={16} /> {t('admin.topUsers', 'Top users by links')}
        </h3>
        {topUsers.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
            {t('admin.noUsers', 'No users yet')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topUsers.map((u) => {
              const pct = (u.linkCount / maxLinkCount) * 100;
              return (
                <div
                  key={u.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}
                >
                  <div
                    style={{
                      flex: '0 0 200px',
                      color: 'var(--text-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={u.email}
                  >
                    {u.email}
                  </div>
                  <ProgressBar pct={pct} />
                  <div
                    className="mono"
                    style={{ flex: '0 0 50px', textAlign: 'right', color: 'var(--text-2)' }}
                  >
                    {u.linkCount}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Links Tab ───────────────────────────────
function LinksTab({
  urls,
  loading,
  filter,
  onFilterChange,
  onDelete,
  onViewStats,
}: {
  urls: AdminUrl[];
  loading: boolean;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  onDelete: (shortCode: string) => void;
  onViewStats: (shortCode: string) => void;
}) {
  const { t } = useTranslation();
  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('admin.filterAll', 'All') },
    { key: 'registered', label: t('admin.filterRegistered', 'Registered') },
    { key: 'anonymous', label: t('admin.filterAnonymous', 'Anonymous') },
  ];

  return (
    <div className="anim-slide-up">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <Filter />
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {t('admin.filter', 'Filter')}:
        </span>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`btn ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onFilterChange(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span
          className="pill"
          style={{ marginLeft: 'auto', backgroundColor: 'var(--surface)', color: 'var(--text-2)' }}
        >
          {urls.length} {t('admin.links', 'links')}
        </span>
      </div>

      <div className="ctt-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 36, marginBottom: 8, borderRadius: 6 }}
              />
            ))}
          </div>
        ) : urls.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
            <LinkIcon size={32} />
            <p style={{ marginTop: 10, fontSize: 14 }}>
              {t('admin.noLinks', 'No links found')}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface)' }}>
                  <Th>{t('admin.thShort', 'Short')}</Th>
                  <Th>{t('admin.thOriginal', 'Original URL')}</Th>
                  <Th>{t('admin.thOwner', 'Owner')}</Th>
                  <Th>{t('admin.thCreated', 'Created')}</Th>
                  <Th>{t('admin.thClicks', 'Clicks')}</Th>
                  <Th>{t('admin.thLimit', 'Limit')}</Th>
                  <Th style={{ textAlign: 'right' }}>{t('admin.thActions', 'Actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {urls.map((url) => {
                  const limitReached = url.limitReached === true;
                  return (
                    <tr
                      key={url.shortCode}
                      style={{
                        borderTop: '1px solid var(--border)',
                        backgroundColor: limitReached ? 'rgba(239,68,68,0.05)' : 'transparent',
                      }}
                    >
                      <Td>
                        <span className="mono" style={{ color: 'var(--accent)' }}>
                          {url.customDomain
                            ? `${url.customDomain}/${url.shortCode}`
                            : `/${url.shortCode}`}
                        </span>
                      </Td>
                      <Td style={{ maxWidth: 280 }}>
                        <a
                          href={url.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-row"
                          style={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'var(--text-2)',
                          }}
                          title={url.originalUrl}
                        >
                          {url.originalUrl}
                        </a>
                      </Td>
                      <Td>
                        {url.userId ? (
                          <div>
                            <div style={{ color: 'var(--text-1)' }}>
                              {url.userEmail || url.userName || url.userId.slice(0, 8)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {t('admin.registered', 'Registered')}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: 'var(--text-2)' }}>
                              {t('admin.anonymous', 'Anonymous')}
                            </div>
                            {url.creatorIp && (
                              <div
                                className="mono"
                                style={{ fontSize: 11, color: 'var(--text-3)' }}
                              >
                                {url.creatorIp}
                              </div>
                            )}
                          </div>
                        )}
                      </Td>
                      <Td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                        {new Date(url.createdAt).toLocaleDateString()}
                      </Td>
                      <Td style={{ color: 'var(--text-1)' }}>{url.clicks ?? 0}</Td>
                      <Td>
                        {url.limitUsage ? (
                          <span
                            className="pill"
                            style={{
                              backgroundColor: limitReached
                                ? 'rgba(239,68,68,0.12)'
                                : 'var(--surface)',
                              color: limitReached ? 'var(--danger)' : 'var(--text-2)',
                            }}
                          >
                            {url.limitUsage.used}/{url.limitUsage.max}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>—</span>
                        )}
                      </Td>
                      <Td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => onViewStats(url.shortCode)}
                          title={t('admin.viewStats', 'View stats')}
                          style={{ marginRight: 6 }}
                        >
                          <Stats />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => onDelete(url.shortCode)}
                          title={t('admin.delete', 'Delete')}
                        >
                          <Trash />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────
function UsersTab({ users, loading }: { users: AdminUser[]; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="anim-slide-up">
      <div className="ctt-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 36, marginBottom: 8, borderRadius: 6 }}
              />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
            <Users size={32} />
            <p style={{ marginTop: 10, fontSize: 14 }}>
              {t('admin.noUsers', 'No users found')}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface)' }}>
                  <Th>{t('admin.thEmail', 'Email')}</Th>
                  <Th>{t('admin.thName', 'Name')}</Th>
                  <Th>{t('admin.thJoined', 'Joined')}</Th>
                  <Th>{t('admin.thVerified', 'Verified')}</Th>
                  <Th style={{ textAlign: 'right' }}>{t('admin.thLinkCount', 'Links')}</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <Td style={{ color: 'var(--text-1)' }}>{u.email}</Td>
                    <Td style={{ color: 'var(--text-2)' }}>{u.name || '—'}</Td>
                    <Td style={{ color: 'var(--text-3)' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </Td>
                    <Td>
                      {u.emailVerified ? (
                        <span
                          className="pill"
                          style={{
                            backgroundColor: 'rgba(16,185,129,0.12)',
                            color: 'var(--success)',
                          }}
                        >
                          ✓
                        </span>
                      ) : (
                        <span
                          className="pill"
                          style={{
                            backgroundColor: 'var(--surface)',
                            color: 'var(--text-3)',
                          }}
                        >
                          —
                        </span>
                      )}
                    </Td>
                    <Td style={{ textAlign: 'right' }}>
                      <span className="mono" style={{ color: 'var(--accent)' }}>
                        {u.linkCount}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Guests Tab ───────────────────────────────
function GuestsTab({ guests, loading }: { guests: AdminGuest[]; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="anim-slide-up">
      <div className="ctt-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 36, marginBottom: 8, borderRadius: 6 }}
              />
            ))}
          </div>
        ) : guests.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
            <Globe size={32} />
            <p style={{ marginTop: 10, fontSize: 14 }}>
              {t('admin.noGuests', 'No guest activity yet')}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface)' }}>
                  <Th>{t('admin.thUuid', 'Client UUID')}</Th>
                  <Th>{t('admin.thIp', 'Last IP')}</Th>
                  <Th>{t('admin.thLastActive', 'Last active')}</Th>
                  <Th>{t('admin.thUsage', 'Usage')}</Th>
                  <Th style={{ textAlign: 'right' }}>{t('admin.thStatus', 'Status')}</Th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => {
                  const display =
                    g.clientUuid.length > 12
                      ? `${g.clientUuid.slice(0, 4)}…${g.clientUuid.slice(-4)}`
                      : g.clientUuid;
                  const pct =
                    g.limitUsage.max > 0
                      ? Math.min(100, (g.limitUsage.used / g.limitUsage.max) * 100)
                      : 0;
                  return (
                    <tr
                      key={g.clientUuid}
                      style={{
                        borderTop: '1px solid var(--border)',
                        backgroundColor: g.limitReached
                          ? 'rgba(239,68,68,0.05)'
                          : 'transparent',
                      }}
                    >
                      <Td>
                        <span className="mono" title={g.clientUuid}>
                          {display}
                        </span>
                      </Td>
                      <Td className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>
                        {g.lastIp || '—'}
                      </Td>
                      <Td style={{ color: 'var(--text-3)' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Clock />
                          {new Date(g.lastActive).toLocaleString()}
                        </span>
                      </Td>
                      <Td style={{ minWidth: 180 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <ProgressBar
                            pct={pct}
                            color={
                              g.limitReached
                                ? 'var(--danger)'
                                : pct > 80
                                ? 'var(--warning)'
                                : 'var(--success)'
                            }
                          />
                          <span
                            className="mono"
                            style={{ fontSize: 12, color: 'var(--text-2)' }}
                          >
                            {g.limitUsage.used}/{g.limitUsage.max}
                          </span>
                        </div>
                      </Td>
                      <Td style={{ textAlign: 'right' }}>
                        {g.limitReached ? (
                          <span
                            className="pill"
                            style={{
                              backgroundColor: 'rgba(239,68,68,0.12)',
                              color: 'var(--danger)',
                            }}
                          >
                            {t('admin.limitReached', 'Limit reached')}
                          </span>
                        ) : (
                          <span
                            className="pill"
                            style={{
                              backgroundColor: 'rgba(16,185,129,0.12)',
                              color: 'var(--success)',
                            }}
                          >
                            {t('admin.active', 'Active')}
                          </span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tiny table helpers ───────────────────────────────
function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: '10px 14px',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
  className,
  title,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={className}
      title={title}
      style={{ padding: '10px 14px', verticalAlign: 'middle', ...style }}
    >
      {children}
    </td>
  );
}

// Edit icon used in tabs (re-exported here so we don't add another import line above)
function Edit({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
