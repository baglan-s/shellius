import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useI18n } from '../../i18n';
import OAuthButtons from './OAuthButtons';

const CLOUD_URL = 'http://localhost:8080';

interface LoginFormProps {
  onSkip?: () => void;
}

export default function LoginForm({ onSkip }: LoginFormProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        <h1 className="auth-title">Shellius</h1>
        <p className="auth-subtitle">
          {isRegister ? t('auth.createAccount') : t('auth.signIn')}
        </p>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          <input
            type="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
          />
          <input
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="primary" disabled={loading}>
            {loading ? '...' : isRegister ? t('auth.register') : t('auth.signInBtn')}
          </button>
        </form>

        <div className="auth-divider">
          <span>{t('auth.or')}</span>
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
          background: var(--bg-primary);
        }
        .auth-card {
          width: 380px;
          padding: 40px;
          background: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        .auth-title {
          font-size: 28px;
          color: var(--accent);
          text-align: center;
          margin-bottom: 8px;
        }
        .auth-subtitle {
          text-align: center;
          color: var(--text-secondary);
          margin-bottom: 24px;
          font-size: 14px;
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .auth-form input { width: 100%; }
        .auth-form button { width: 100%; padding: 12px; }
        .auth-error { color: var(--danger); font-size: 13px; }
        .auth-divider {
          text-align: center;
          margin: 20px 0;
          color: var(--text-secondary);
          font-size: 13px;
        }
        .auth-toggle {
          width: 100%;
          background: none;
          color: var(--accent);
          margin-top: 16px;
          font-size: 13px;
        }
        .auth-skip {
          width: 100%;
          background: none;
          color: var(--text-secondary);
          margin-top: 8px;
          font-size: 12px;
        }
        .auth-skip:hover { color: var(--text-primary); }
      `}</style>
    </div>
  );
}
