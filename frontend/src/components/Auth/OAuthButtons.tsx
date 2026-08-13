const CLOUD_URL = 'http://localhost:8080';

export default function OAuthButtons() {
  const handleOAuth = (provider: string) => {
    window.open(`${CLOUD_URL}/api/auth/oauth/${provider}`, '_blank');
  };

  return (
    <div className="oauth-buttons">
      <button className="oauth-btn" onClick={() => handleOAuth('google')}>
        Continue with Google
      </button>
      <button className="oauth-btn" onClick={() => handleOAuth('github')}>
        Continue with GitHub
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
