import { useI18n } from '../../i18n';

const CLOUD_URL = 'http://localhost:8080';

export default function OAuthButtons() {
  const { t } = useI18n();

  const handleOAuth = (provider: string) => {
    window.open(`${CLOUD_URL}/api/auth/oauth/${provider}`, '_blank');
  };

  return (
    <div className="oauth-buttons">
      <button className="oauth-btn" onClick={() => handleOAuth('google')}>
        {t('auth.google')}
      </button>
      <button className="oauth-btn" onClick={() => handleOAuth('github')}>
        {t('auth.github')}
      </button>

      <style>{`
        .oauth-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .oauth-btn {
          width: 100%;
          padding: 10px;
          background: var(--bg-surface);
          color: var(--text-primary);
          border: 1px solid var(--border);
          font-size: 14px;
        }
        .oauth-btn:hover {
          background: var(--border);
        }
      `}</style>
    </div>
  );
}
