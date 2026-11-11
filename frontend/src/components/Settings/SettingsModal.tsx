import { useState, useEffect } from 'react';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useWS } from '../../contexts/WebSocketContext';
import type { Locale } from '../../i18n';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, locale, setLocale } = useI18n();
  const { send, subscribe } = useWS();
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const [activeSection, setActiveSection] = useState<'profile' | 'language' | 'theme' | 'sync'>('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleDeleteAccount = () => {
    logout();
    onClose();
  };

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.id === 'sync-push' || msg.id === 'sync-pull') {
        setSyncing(false);
        if (msg.type === 'success') {
          const p = msg.payload as any;
          setSyncStatus(`${msg.id === 'sync-push' ? 'Pushed' : 'Pulled'}: ${p.count ?? 0} items`);
        } else if (msg.type === 'error') {
          setSyncStatus((msg.payload as any)?.message || 'Sync failed');
        }
      }
    });
  }, [subscribe]);

  const handlePush = () => {
    setSyncing(true);
    setSyncStatus('');
    send({ type: 'sync.push', id: 'sync-push' });
  };

  const handlePull = () => {
    setSyncing(true);
    setSyncStatus('');
    send({ type: 'sync.pull', id: 'sync-pull' });
  };

  const languages: { code: Locale; label: string }[] = [
    { code: 'en', label: t('lang.en') },
    { code: 'ru', label: t('lang.ru') },
    { code: 'kk', label: t('lang.kk') },
  ];

  const navItems = [
    { key: 'profile' as const, label: t('settings.profile') },
    { key: 'language' as const, label: t('settings.language') },
    { key: 'theme' as const, label: t('settings.theme') },
    { key: 'sync' as const, label: t('sync.title') },
  ];

  const email = localStorage.getItem('shellius_email') || 'Local User';
  const initial = email[0].toUpperCase();

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-header-title">{t('settings.title')}</div>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="settings-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`settings-nav-item ${activeSection === item.key ? 'active' : ''}`}
                onClick={() => setActiveSection(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="settings-content">
            {activeSection === 'profile' && (
              <div className="settings-section">
                <div className="profile-info">
                  <div className="profile-avatar">{initial}</div>
                  <div>
                    <div className="profile-email">{email}</div>
                    <div className="profile-status">
                      {isAuthenticated ? 'Signed in' : 'Offline mode'}
                    </div>
                  </div>
                </div>

                {isAuthenticated && (
                  <div className="profile-actions">
                    <button className="settings-btn" onClick={handleLogout}>
                      {t('settings.logout')}
                    </button>
                    {!showDeleteConfirm ? (
                      <button
                        className="settings-btn settings-btn-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        {t('settings.deleteAccount')}
                      </button>
                    ) : (
                      <div className="delete-confirm">
                        <div className="delete-warning">{t('settings.deleteConfirm')}</div>
                        <div className="delete-confirm-actions">
                          <button className="delete-confirm-btn" onClick={handleDeleteAccount}>
                            {t('settings.deleteAccount')}
                          </button>
                          <button
                            className="delete-cancel-btn"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isAuthenticated && (
                  <button className="settings-signin-btn" onClick={onClose}>
                    Sign In
                  </button>
                )}
              </div>
            )}

            {activeSection === 'language' && (
              <div className="settings-section">
                <div className="settings-section-title">{t('settings.selectLanguage')}</div>
                <div className="language-list">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      className={`language-item ${locale === lang.code ? 'active' : ''}`}
                      onClick={() => setLocale(lang.code)}
                    >
                      <span>{lang.label}</span>
                      {locale === lang.code && (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'theme' && (
              <div className="settings-section">
                <div className="settings-section-title">{t('settings.theme')}</div>
                <div className="theme-toggle-row">
                  <div className="theme-toggle-info">
                    <div className="theme-toggle-label">
                      {theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
                    </div>
                    <div className="theme-toggle-hint">{t('settings.themeHint')}</div>
                  </div>
                  <button className="theme-toggle-btn" onClick={toggleTheme}>
                    {theme === 'dark' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                        <path d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.95 7.95l-.71-.71M4.05 4.05l-.71-.71" />
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'sync' && (
              <div className="settings-section">
                <div className="settings-section-title">{t('sync.title')}</div>
                <div className="sync-status">
                  {isAuthenticated
                    ? 'Sync your hosts, keys, snippets and vault entries to the cloud.'
                    : t('sync.notConnected')}
                </div>
                {isAuthenticated ? (
                  <div className="sync-actions-wrapper">
                    <div className="sync-actions">
                      <button className="sync-push" onClick={handlePush} disabled={syncing}>
                        {syncing ? '...' : t('sync.push')}
                      </button>
                      <button className="sync-pull" onClick={handlePull} disabled={syncing}>
                        {syncing ? '...' : t('sync.pull')}
                      </button>
                    </div>
                    {syncStatus && <div className="sync-result">{syncStatus}</div>}
                  </div>
                ) : (
                  <button className="settings-signin-btn" onClick={onClose}>
                    Sign in to enable cloud sync
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <style>{`
          .settings-overlay {
            position: fixed;
            inset: 0;
            background: rgba(10,11,22,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadein 200ms ease;
          }
          .settings-modal {
            width: 520px;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 24px 60px rgba(0,0,0,0.5);
            animation: popin 200ms ease;
          }
          .settings-header {
            height: 48px;
            display: flex;
            align-items: center;
            padding: 0 16px;
            border-bottom: 1px solid var(--border);
          }
          .settings-header-title {
            flex: 1;
            font-size: 15px;
            font-weight: 600;
          }
          .settings-close {
            width: 26px;
            height: 26px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            font-size: 12px;
            background: none;
            padding: 0;
            border: none;
            cursor: pointer;
          }
          .settings-close:hover { background: var(--bg-surface); color: var(--text-primary); }
          .settings-body {
            display: flex;
            min-height: 320px;
          }
          .settings-nav {
            width: 140px;
            flex: 0 0 140px;
            border-right: 1px solid var(--border);
            padding: 10px 8px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            background: var(--bg-secondary);
          }
          .settings-nav-item {
            font-size: 13px;
            padding: 8px 10px;
            border-radius: var(--radius-md);
            background: transparent;
            color: var(--text-secondary);
            text-align: left;
            border: none;
            cursor: pointer;
          }
          .settings-nav-item.active {
            background: var(--bg-surface);
            color: var(--text-primary);
          }
          .settings-nav-item:hover {
            background: var(--bg-surface);
            color: var(--text-primary);
          }
          .settings-content {
            flex: 1;
            min-width: 0;
            padding: 18px;
          }
          .settings-section {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .settings-section-title {
            font-size: 14px;
            font-weight: 600;
          }
          .profile-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .profile-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--accent);
            color: #0d1b28;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 700;
            flex: 0 0 48px;
          }
          .profile-email { font-size: 15px; }
          .profile-status { font-size: 12px; color: var(--text-secondary); }
          .profile-actions {
            display: flex;
            gap: 8px;
          }
          .settings-btn {
            font-size: 12px;
            padding: 8px 14px;
            border-radius: var(--radius-md);
            background: var(--bg-surface);
            border: 1px solid var(--border);
            color: var(--text-primary);
            cursor: pointer;
          }
          .settings-btn:hover { background: var(--border); }
          .settings-btn-danger {
            background: transparent;
            border-color: var(--danger);
            color: var(--danger);
          }
          .settings-btn-danger:hover { background: var(--danger); color: #fff; }
          .settings-signin-btn {
            font-size: 12px;
            font-weight: 600;
            padding: 8px 14px;
            border-radius: var(--radius-md);
            background: var(--accent);
            color: #0d1b28;
            align-self: flex-start;
            border: none;
            cursor: pointer;
          }
          .settings-signin-btn:hover { background: var(--accent-hover); }
          .delete-confirm {
            background: rgba(239,68,68,0.08);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: var(--radius);
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .delete-warning {
            font-size: 12px;
            color: var(--text-primary);
            line-height: 1.5;
          }
          .delete-confirm-actions { display: flex; gap: 8px; }
          .delete-confirm-btn {
            font-size: 11px;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: var(--radius-md);
            background: var(--danger);
            color: #fff;
            border: none;
            cursor: pointer;
          }
          .delete-cancel-btn {
            font-size: 11px;
            padding: 6px 12px;
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            background: none;
            border: none;
            cursor: pointer;
          }
          .delete-cancel-btn:hover { color: var(--text-primary); }
          .language-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .language-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 11px 12px;
            border-radius: var(--radius);
            background: var(--bg-surface);
            border: 1px solid var(--border);
            color: var(--text-primary);
            font-size: 14px;
            cursor: pointer;
          }
          .language-item.active { border-color: var(--accent); }
          .language-item:hover { background: var(--bg-surface-hover); }
          .sync-status {
            font-size: 12px;
            color: var(--text-secondary);
            line-height: 1.5;
          }
          .sync-actions { display: flex; gap: 8px; }
          .sync-push {
            font-size: 12px;
            font-weight: 600;
            padding: 8px 14px;
            border-radius: var(--radius-md);
            background: var(--accent);
            color: #0d1b28;
            border: none;
            cursor: pointer;
          }
          .sync-push:hover { background: var(--accent-hover); }
          .sync-pull {
            font-size: 12px;
            padding: 8px 14px;
            border-radius: var(--radius-md);
            background: var(--bg-surface);
            border: 1px solid var(--border);
            color: var(--text-primary);
            cursor: pointer;
          }
          .sync-pull:hover { background: var(--border); }
          .sync-actions-wrapper { display: flex; flex-direction: column; gap: 8px; }
          .sync-result { font-size: 12px; color: var(--text-secondary); }
          .sync-push:disabled, .sync-pull:disabled { opacity: 0.5; cursor: not-allowed; }
          .theme-toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
          }
          .theme-toggle-info { display: flex; flex-direction: column; gap: 2px; }
          .theme-toggle-label { font-size: 14px; font-weight: 500; }
          .theme-toggle-hint { font-size: 11px; color: var(--text-secondary); }
          .theme-toggle-btn {
            width: 36px;
            height: 36px;
            border-radius: var(--radius-md);
            background: var(--bg-primary);
            border: 1px solid var(--border);
            color: var(--text-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
          }
          .theme-toggle-btn:hover { border-color: var(--accent); color: var(--accent); }
        `}</style>
      </div>
    </div>
  );
}
