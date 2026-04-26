// CutToTech shared design components
import React, { useState, useEffect, useRef } from 'react';
import { LogoLink, Check, X } from './icons';

// ─── Logo ───────────────────────────────
export function Logo({ size = 32, textSize = 18 }: { size?: number; textSize?: number }) {
  return (
    <div className="ctt-logo" style={{ fontSize: textSize }}>
      <div className="ctt-logomark" style={{ width: size, height: size, borderRadius: size * 0.25 }}>
        <LogoLink />
      </div>
      <span>CutToTech</span>
    </div>
  );
}

// ─── Animated Number Counter ───────────────────────────────
export function AnimatedNumber({ value, format = (n: number) => n.toLocaleString(), duration = 1200 }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf: number;
    let start: number;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(Math.round(n * 10) / 10)}</>;
}

// ─── Sparkline mini-chart ───────────────────────────────
export function Sparkline({ data, w = 60, h = 22, color = '#4F46E5', delay = 0 }: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  delay?: number;
}) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - (v / max) * (h - 2) - 1] as [number, number]);
  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(100);
  useEffect(() => { if (pathRef.current) setLen(pathRef.current.getTotalLength()); }, []);
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <path ref={pathRef} d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: len, strokeDashoffset: len, animation: `drawLine 1.1s ease-out ${delay}ms forwards`, '--dash-len': len } as React.CSSProperties}/>
    </svg>
  );
}

// ─── SVG Line Chart ───────────────────────────────
export function LineChart({ data, height = 220 }: { data: { l: string; v: number }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.v), 1);
  const W = 520, H = height, padL = 36, padB = 28, padT = 16, padR = 12;
  const w = W - padL - padR, h = H - padT - padB;
  const pts = data.map((d, i) => [padL + (i / (data.length - 1)) * w, padT + h - (d.v / max) * h] as [number, number]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
  const area = path + ` L${padL + w},${padT + h} L${padL},${padT + h} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 1, 2, 3, 4].map(i => {
        const y = padT + (h / 4) * i;
        return <line key={i} x1={padL} x2={padL + w} y1={y} y2={y} stroke="var(--border)" strokeDasharray="3 4"/>;
      })}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <text key={i} x={padL - 8} y={padT + h - h * p + 4} fontSize="10" fill="var(--text-3)" textAnchor="end">{Math.round(max * p)}</text>
      ))}
      {data.map((d, i) => i % Math.ceil(data.length / 7) === 0 && (
        <text key={i} x={pts[i][0]} y={H - 10} fontSize="10" fill="var(--text-3)" textAnchor="middle">{d.l}</text>
      ))}
      <path d={area} fill="var(--accent)" opacity="0.05"/>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--card)" stroke="var(--accent)" strokeWidth="1.5"/>)}
    </svg>
  );
}

// ─── SVG Donut Chart ───────────────────────────────
export function DonutChart({ segments, total }: {
  segments: { name: string; pct: number; color: string }[];
  total: number;
}) {
  const R = 70, C = 100, strokeW = 18;
  let offset = 0;
  const circ = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 220 }}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--surface)" strokeWidth={strokeW}/>
      {segments.map((s, i) => {
        const len = (s.pct / 100) * circ;
        const el = <circle key={i} cx={C} cy={C} r={R} fill="none" stroke={s.color} strokeWidth={strokeW}
          strokeDasharray={`${len} ${circ}`} strokeDashoffset={-offset} transform={`rotate(-90 ${C} ${C})`} strokeLinecap="butt"/>;
        offset += len;
        return el;
      })}
      <text x={C} y={C - 4} fontSize="26" fontWeight="700" fill="var(--text-1)" textAnchor="middle">{total.toLocaleString()}</text>
      <text x={C} y={C + 18} fontSize="11" fill="var(--text-3)" textAnchor="middle">total clicks</text>
    </svg>
  );
}

// ─── Mini decorative bars ───────────────────────────────
export function MiniBars({ values = [34, 58, 42, 76, 62, 88, 70], highlight = 5 }: { values?: number[]; highlight?: number }) {
  const max = Math.max(...values);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {values.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          height: (v / max) * 100 + '%',
          backgroundColor: i === highlight ? 'var(--accent)' : 'var(--border)',
          borderRadius: 3,
        }}/>
      ))}
    </div>
  );
}

// ─── Mini world map ───────────────────────────────
function genBlob(cx: number, cy: number, rx: number, ry: number, n: number): [number, number][] {
  const arr: [number, number][] = [];
  let seed = Math.floor(cx * 1000 + cy * 1000);
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    arr.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return arr;
}

export function MiniWorldMap() {
  const shapes = [
    ...genBlob(0.10, 0.30, 0.12, 0.18, 22),
    ...genBlob(0.22, 0.62, 0.06, 0.14, 14),
    ...genBlob(0.47, 0.28, 0.06, 0.08, 14),
    ...genBlob(0.50, 0.52, 0.08, 0.16, 22),
    ...genBlob(0.65, 0.32, 0.16, 0.14, 32),
    ...genBlob(0.80, 0.68, 0.06, 0.06, 10),
  ];
  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: '50%' }}>
      <svg viewBox="0 0 400 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {shapes.map((d, i) => (
          <circle key={i} cx={d[0] * 400} cy={d[1] * 200} r="1.6" fill="var(--text-3)" opacity="0.4"/>
        ))}
        {[[0.18, 0.34], [0.48, 0.3], [0.66, 0.35], [0.78, 0.68]].map((p, i) =>
          <g key={i}>
            <circle cx={p[0] * 400} cy={p[1] * 200} r="6" fill="var(--accent)" opacity="0.18"/>
            <circle cx={p[0] * 400} cy={p[1] * 200} r="3" fill="var(--accent)"/>
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────
export function StatCard({ value, label, icon, color = '#4F46E5', delay = 0, animated = false }: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  color?: string;
  delay?: number;
  animated?: boolean;
}) {
  return (
    <div className="stat-card anim-slide-up" style={{ animationDelay: delay + 'ms' }}>
      <div>
        <div className="stat-num">
          {animated && typeof value === 'number' ? <AnimatedNumber value={value}/> : value}
        </div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-icon-bubble" style={{ background: color + '14', color }}>
        {icon}
      </div>
    </div>
  );
}

// ─── Progress Bar (for country/referrer lists) ───────────────────────────────
export function ProgressBar({ pct, color = 'var(--accent)' }: { pct: number; color?: string }) {
  return (
    <div style={{ flex: 1, height: 6, backgroundColor: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 3, transition: 'width 600ms ease-out' }}/>
    </div>
  );
}

// ─── Toast ───────────────────────────────
export function Toast({ msg, kind = 'success', onDismiss }: { msg: string; kind?: 'success' | 'error'; onDismiss?: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss?.(), 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div className={`ctt-toast ${kind === 'error' ? 'error' : ''}`}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: kind === 'error' ? '#FEE2E2' : '#DCFCE7', color: kind === 'error' ? 'var(--danger)' : 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'error' ? <X size={12}/> : <Check size={14}/>}
      </div>
      <span>{msg}</span>
    </div>
  );
}

// ─── Live Activity Ticker ───────────────────────────────
interface RecentClick {
  shortCode: string;
  country: string;
  city: string;
  timestamp: string;
}

const COUNTRY_FLAG: Record<string, string> = {
  'Russia': '🇷🇺', 'RU': '🇷🇺',
  'Germany': '🇩🇪', 'DE': '🇩🇪',
  'Japan': '🇯🇵', 'JP': '🇯🇵',
  'United States': '🇺🇸', 'US': '🇺🇸',
  'Brazil': '🇧🇷', 'BR': '🇧🇷',
  'France': '🇫🇷', 'FR': '🇫🇷',
  'United Kingdom': '🇬🇧', 'GB': '🇬🇧',
  'Canada': '🇨🇦', 'CA': '🇨🇦',
  'Australia': '🇦🇺', 'AU': '🇦🇺',
  'India': '🇮🇳', 'IN': '🇮🇳',
  'Netherlands': '🇳🇱', 'NL': '🇳🇱',
  'Spain': '🇪🇸', 'ES': '🇪🇸',
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LiveActivity({ accessToken }: { accessToken?: string }) {
  const [events, setEvents] = useState<RecentClick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    let cancelled = false;
    const fetchEvents = async () => {
      try {
        // Aggregate recent clicks across all user URLs (repo backend has no /recent-clicks)
        const { getApiUrl } = await import('../../utils/api/config');
        const urlsResp = await fetch(getApiUrl('user/urls'), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!urlsResp.ok) throw new Error('failed');
        const urlsData = await urlsResp.json();
        const list = (urlsData.urls || []) as Array<{ shortCode: string }>;
        const recent: RecentClick[] = [];
        // Get stats for top 5 most recent URLs to avoid flooding
        for (const u of list.slice(0, 5)) {
          try {
            const r = await fetch(getApiUrl(`api/stats/${u.shortCode}`), {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!r.ok) continue;
            const data = await r.json();
            for (const s of (data.stats || []) as Array<{ country: string; city?: string; timestamp: string }>) {
              recent.push({
                shortCode: u.shortCode,
                country: s.country,
                city: s.city || '',
                timestamp: s.timestamp,
              });
            }
          } catch { /* skip */ }
        }
        recent.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (!cancelled) {
          setEvents(recent.slice(0, 10));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    fetchEvents();
    // Poll every 5 seconds for updates (real clicks come in via /redirect endpoint)
    const iv = setInterval(fetchEvents, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [accessToken]);

  return (
    <div className="ctt-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: events.length > 0 ? 'var(--success)' : 'var(--text-3)', opacity: 0.5, animation: events.length > 0 ? 'ping 1.6s ease-out infinite' : 'none' }}/>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: events.length > 0 ? 'var(--success)' : 'var(--text-3)' }}/>
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Live clicks</h3>
        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {loading ? 'Loading...' : events.length > 0 ? 'Streaming' : 'Idle'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 100, justifyContent: events.length === 0 ? 'center' : 'flex-start' }}>
        {events.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', padding: '12px 0' }}>
            No clicks yet. Share your links to see activity here.
          </div>
        ) : (
          events.slice(0, 4).map((e, i) => (
            <div key={`${e.shortCode}-${e.timestamp}-${i}`} className="live-ticker-item" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, opacity: 1 - i * 0.2 }}>
              <span style={{ fontSize: 16 }}>{COUNTRY_FLAG[e.country] || '🌐'}</span>
              <span className="mono" style={{ color: 'var(--accent)' }}>/{e.shortCode}</span>
              <span style={{ color: 'var(--text-2)', flex: 1 }}>click from {e.city || e.country}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{timeAgo(e.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Google SVG Logo ───────────────────────────────
export function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.8h3.6c2.1-1.9 3.3-4.8 3.3-8.1z"/>
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.4-.4-2s.1-1.3.4-2V7.2H2.1C1.4 8.7 1 10.3 1 12s.4 3.3 1.1 4.8L5.8 14z"/>
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.3 15 1 12 1 7.7 1 3.9 3.5 2.1 7.2L5.8 10c.9-2.7 3.3-4.6 6.2-4.6z"/>
    </svg>
  );
}

// ─── GitHub SVG Logo ───────────────────────────────
export function GitHubLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.3-.1-.3-.6-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.9 1.3 2 1.3 3.3 0 4.7-2.9 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/>
    </svg>
  );
}
