import { useI18n } from '../../i18n';

const CLOUD_URL = 'http://localhost:8080';

export default function OAuthButtons() {
  const { t } = useI18n();

  const handleOAuth = (provider: string) => {
    window.open(`${CLOUD_URL}/api/auth/oauth/${provider}`, '_blank');
  };

  return (
    <div className="oauth-buttons">
      <button className="oauth-btn oauth-google" onClick={() => handleOAuth('google')}>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-4.9 3.4-8.5z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.2-6.9-5.1H1.3v3a12 12 0 0 0 10.7 6.7z" />
          <path fill="#FBBC05" d="M5.1 14.3a7.2 7.2 0 0 1 0-4.6v-3H1.3a12 12 0 0 0 0 10.6z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.3 6.7l3.8 3a7.1 7.1 0 0 1 6.9-4.9z" />
        </svg>
        {t('auth.google')}
      </button>
      <button className="oauth-btn oauth-github" onClick={() => handleOAuth('github')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#ffffff">
          <path d="M8 0a8 8 0 0 0-2.5 15.6c.4.1.5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5 0-.5 0-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7 0-.6.3-1 .5-1.2-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.5 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.3.6.8.6 1.6v2.4c0 .2.1.5.6.4A8 8 0 0 0 8 0z" />
        </svg>
        {t('auth.github')}
      </button>

      <style>{`
        .oauth-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .oauth-btn {
          height: 38px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          cursor: pointer;
          border: none;
        }
        .oauth-google {
          background: #ffffff;
          color: #1f2937;
        }
        .oauth-google:hover {
          background: #eef0f3;
        }
        .oauth-github {
          background: #24292f;
          color: #ffffff;
          border: 1px solid #3a4046;
        }
        .oauth-github:hover {
          background: #2f363d;
        }
      `}</style>
    </div>
  );
}
