import { Logo } from './design/shared';
import { Moon, Sun, Shield } from './design/icons';
import LanguageSelector from './LanguageSelector';

interface HeaderProps {
  user: { id?: string; email?: string; name?: string; user_metadata?: { name?: string }; is_admin?: boolean } | null;
  dark: boolean;
  onToggleDark: () => void;
  onAuthClick: () => void;
  onSignOut: () => void;
  onLogoClick: () => void;
  onAdminClick?: () => void;
  onDashboardClick?: () => void;
  onSettingsClick?: () => void;
  currentView?: string;
}

export default function Header({
  user,
  dark,
  onToggleDark,
  onAuthClick,
  onSignOut,
  onLogoClick,
  onAdminClick,
  onDashboardClick,
  onSettingsClick,
  currentView = '',
}: HeaderProps) {
  const displayName = user?.user_metadata?.name || user?.name || user?.email || '';
  const isAdmin = user?.is_admin;

  if (!user) {
    return (
      <header className="ctt-header">
        <button onClick={onLogoClick} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <Logo />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LanguageSelector />
          <button className="btn-icon" onClick={onToggleDark} aria-label="Toggle theme">
            {dark ? <Sun /> : <Moon />}
          </button>
          <button className="btn btn-secondary" onClick={onAuthClick}>Sign In</button>
        </div>
      </header>
    );
  }

  const navItems = [
    { key: 'dashboard', label: 'Links', onClick: onDashboardClick },
    { key: 'settings', label: 'Settings', onClick: onSettingsClick },
  ];

  return (
    <header className="ctt-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <button onClick={onLogoClick} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <Logo />
        </button>
        <nav style={{ display: 'flex', gap: 4 }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={item.onClick}
              style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                color: currentView === item.key ? 'var(--text-1)' : 'var(--text-2)',
                backgroundColor: currentView === item.key ? 'var(--surface)' : 'transparent',
                border: 'none', cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={onAdminClick}
              style={{
                padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                color: currentView === 'admin' ? 'var(--text-1)' : 'var(--text-2)',
                backgroundColor: currentView === 'admin' ? 'var(--surface)' : 'transparent',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Shield size={14} />
              Admin
            </button>
          )}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LanguageSelector />
        <button className="btn-icon" onClick={onToggleDark} aria-label="Toggle theme">
          {dark ? <Sun /> : <Moon />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 600,
          }}>
            {(displayName || '?')[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{displayName}</span>
        </div>
        <button className="btn btn-ghost" onClick={onSignOut} style={{ fontSize: 13 }}>
          Sign Out
        </button>
      </div>
    </header>
  );
}
