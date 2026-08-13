import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import OAuthButtons from './OAuthButtons';

const CLOUD_URL = 'http://localhost:8080';

export default function LoginForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
        return;
      }

      const data = await res.json();
      login(data.token);
    } catch {
      setError('Connection failed. Check if cloud server is running.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Shellius</h1>
        <p className="auth-subtitle">
          {isRegister ? 'Create an account' : 'Sign in to your account'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="primary">
            {isRegister ? 'Register' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <OAuthButtons />

        <button
          className="auth-toggle"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister
            ? 'Already have an account? Sign in'
            : "Don't have an account? Register"}
        </button>
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
        .auth-form input {
          width: 100%;
        }
        .auth-form button {
          width: 100%;
          padding: 12px;
        }
        .auth-error {
          color: var(--danger);
          font-size: 13px;
        }
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
      `}</style>
    </div>
  );
}
