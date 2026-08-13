import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../stores/authStore';
import type { Locale } from '../../i18n';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { t, locale, setLocale } = useI18n();
  const logout = useAuthStore((s) => s.logout);
  const [activeSection, setActiveSection] = useState<'profile' | 'language'>('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleDeleteAccount = () => {
    // TODO: call cloud API to delete account
    logout();
    onClose();
  };

  const languages: { code: Locale; label: string }[] = [
    { code: 'en', label: t('lang.en') },
    { code: 'ru', label: t('lang.ru') },
    { code: 'kk', label: t('lang.kk') },
  ];

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('settings.title')}</h2>
          <button className="settings-close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-nav">
            <button
              className={`settings-nav-item ${activeSection === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveSection('profile')}
            >
              {t('settings.profile')}
            </button>
            <button
              className={`settings-nav-item ${activeSection === 'language' ? 'active' : ''}`}
              onClick={() => setActiveSection('language')}
            >
              {t('settings.language')}
            </button>
          </div>

          <div className="settings-content">
            {activeSection === 'profile' && (
              <div className="settings-section">
                <div className="profile-info">
                  <div className="profile-avatar">
                    {(localStorage.getItem('shellius_email') || 'U')[0].toUpperCase()}
                  </div>
                  <div className="profile-details">
                    <div className="profile-email">
                      {localStorage.getItem('shellius_email') || 'Local User'}
                    </div>
                  </div>
                </div>

                <div className="settings-actions">
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
                      <p className="delete-warning">{t('settings.deleteConfirm')}</p>
                      <div className="delete-confirm-actions">
                        <button
                          className="settings-btn settings-btn-danger"
                          onClick={handleDeleteAccount}
                        >
                          {t('common.delete')}
                        </button>
                        <button
                          className="settings-btn"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'language' && (
              <div className="settings-section">
                <p className="settings-label">{t('settings.selectLanguage')}</p>
                <div className="language-list">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      className={`language-item ${locale === lang.code ? 'active' : ''}`}
                      onClick={() => setLocale(lang.code)}
                    >
                      <span className="language-name">{lang.label}</span>
                      {locale === lang.code && <span className="language-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          .settings-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .settings-modal {
            width: 520px;
            max-height: 80vh;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .settings-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
          }
          .settings-header h2 {
            font-size: 16px;
            font-weight: 600;
          }
          .settings-close {
            background: none;
            color: var(--text-secondary);
            font-size: 16px;
            padding: 4px 8px;
          }
          .settings-close:hover {
            color: var(--text-primary);
          }
          .settings-body {
            display: flex;
            flex: 1;
            min-height: 300px;
          }
          .settings-nav {
            width: 140px;
            border-right: 1px solid var(--border);
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .settings-nav-item {
            padding: 8px 12px;
            background: none;
            color: var(--text-secondary);
            text-align: left;
            font-size: 13px;
            border-radius: var(--radius);
          }
          .settings-nav-item.active {
            background: var(--bg-surface);
            color: var(--text-primary);
          }
          .settings-nav-item:hover {
            background: var(--bg-surface);
          }
          .settings-content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
          }
          .settings-section {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .profile-info {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            background: var(--bg-surface);
            border-radius: var(--radius);
          }
          .profile-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--accent);
            color: var(--bg-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 700;
          }
          .profile-email {
            font-size: 15px;
            font-weight: 500;
          }
          .settings-actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .settings-btn {
            padding: 10px 16px;
            background: var(--bg-surface);
            color: var(--text-primary);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            font-size: 13px;
            text-align: left;
          }
          .settings-btn:hover {
            background: var(--border);
          }
          .settings-btn-danger {
            color: var(--danger);
            border-color: var(--danger);
          }
          .settings-btn-danger:hover {
            background: var(--danger);
            color: white;
          }
          .delete-confirm {
            padding: 12px;
            background: var(--bg-surface);
            border-radius: var(--radius);
            border: 1px solid var(--danger);
          }
          .delete-warning {
            font-size: 13px;
            color: var(--danger);
            margin-bottom: 12px;
          }
          .delete-confirm-actions {
            display: flex;
            gap: 8px;
          }
          .settings-label {
            font-size: 13px;
            color: var(--text-secondary);
          }
          .language-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .language-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--bg-surface);
            color: var(--text-primary);
            border-radius: var(--radius);
            font-size: 14px;
            border: 1px solid transparent;
          }
          .language-item.active {
            border-color: var(--accent);
          }
          .language-item:hover {
            background: var(--border);
          }
          .language-check {
            color: var(--accent);
            font-weight: 700;
          }
        `}</style>
      </div>
    </div>
  );
}
