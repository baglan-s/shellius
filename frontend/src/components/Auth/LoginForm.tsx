import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../i18n';
import OAuthButtons from './OAuthButtons';

const CLOUD_URL = 'https://app.shellcat.kz';

interface LoginFormProps {
  onSkip?: () => void;
}

export default function LoginForm({ onSkip }: LoginFormProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(`${CLOUD_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text);
        setLoading(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem('shellius_email', email);
      login(data.token);
    } catch {
      setError(t('auth.connectionFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-title">Shellius</div>
          <div className="auth-subtitle">
            {isRegister ? t('auth.createAccount') : t('auth.signIn')}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          <div className="auth-input-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" />
            </svg>
            <input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-input-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.8" strokeLinecap="round">
              <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button type="button" className="auth-eye" onClick={() => setShowPassword(!showPassword)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading && <div className="auth-spinner" />}
            {isRegister ? t('auth.register') : t('auth.signInBtn')}
          </button>
        </form>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span>{t('auth.or')}</span>
          <div className="auth-divider-line" />
        </div>

        <OAuthButtons />

        <button
          className="auth-toggle"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
        </button>

        {onSkip && (
          <button className="auth-skip" onClick={onSkip}>
            {t('auth.skip')}
          </button>
        )}
      </div>

      <style>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: var(--bg-secondary);
          animation: fadein 200ms ease;
        }
        .auth-card {
          width: 380px;
          padding: 28px;
          background: var(--bg-primary);
          border-radius: 12px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.45);
        }
        .auth-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 4px;
        }
        .auth-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: -0.03em;
        }
        .auth-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .auth-input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0 12px;
        }
        .auth-input-wrap:focus-within {
          border-color: var(--accent);
        }
        .auth-input-wrap input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          padding: 9px 0;
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
        }
        .auth-input-wrap input:focus {
          border: none;
        }
        .auth-eye {
          background: none;
          color: var(--text-secondary);
          padding: 0;
          display: flex;
          cursor: pointer;
        }
        .auth-eye:hover { color: var(--text-primary); }
        .auth-error { color: var(--danger); font-size: 12px; margin-top: -8px; }
        .auth-submit {
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--accent);
          color: #0d1b28;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          border: none;
        }
        .auth-submit:hover { background: var(--accent-hover); }
        .auth-spinner {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(13,27,40,0.3);
          border-top-color: #0d1b28;
          animation: spin 700ms linear infinite;
        }
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-secondary);
          font-size: 12px;
        }
        .auth-divider-line {
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .auth-toggle {
          text-align: center;
          background: none;
          color: var(--text-secondary);
          font-size: 12px;
          margin-top: 2px;
          cursor: pointer;
          border: none;
          padding: 0;
        }
        .auth-toggle:hover { color: var(--text-primary); }
        .auth-skip {
          text-align: center;
          background: none;
          color: #52525b;
          font-size: 12px;
          cursor: pointer;
          border: none;
          padding: 0;
        }
        .auth-skip:hover { color: var(--text-secondary); }
      `}</style>
    </div>
  );
}
