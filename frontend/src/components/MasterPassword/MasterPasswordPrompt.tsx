import { useState } from 'react';
import { useI18n } from '../../i18n';

interface MasterPasswordPromptProps {
  configured: boolean;
  onSubmit: (password: string) => void;
  error?: string;
  loading?: boolean;
}

export default function MasterPasswordPrompt({ configured, onSubmit, error, loading }: MasterPasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const { t } = useI18n();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!configured) {
      if (password.length < 6) {
        setLocalError(t('master.minLength'));
        return;
      }
      if (password !== confirm) {
        setLocalError(t('master.mismatch'));
        return;
      }
    }

    onSubmit(password);
  };

  const displayError = error || localError;

  return (
    <div className="master-container">
      <div className="master-card">
        <div className="master-header">
          <div className="master-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              <circle cx="12" cy="15" r="1.5" />
              <path d="M12 16.5V18" />
            </svg>
          </div>
          <div className="master-title">Shellcat</div>
          <div className="master-subtitle">
            {configured ? t('master.unlock') : t('master.setup')}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="master-form">
          <div className="master-input-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.8" strokeLinecap="round">
              <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('master.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
            />
            <button type="button" className="master-eye" onClick={() => setShowPassword(!showPassword)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          {!configured && (
            <div className="master-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.8" strokeLinecap="round">
                <path d="M9 12l2 2 4-4" /><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('master.confirm')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {displayError && <div className="master-error">{displayError}</div>}

          <button
            type="submit"
            className="master-submit"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading && <div className="master-spinner" />}
            {configured ? t('master.unlockBtn') : t('master.setupBtn')}
          </button>
        </form>

        <div className="master-hint">
          {configured ? t('master.unlockHint') : t('master.setupHint')}
        </div>
      </div>

      <style>{`
        .master-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: var(--bg-secondary);
          animation: fadein 200ms ease;
        }
        .master-card {
          width: 380px;
          padding: 28px;
          background: var(--bg-primary);
          border-radius: 12px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.45);
        }
        .master-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .master-icon { margin-bottom: 4px; }
        .master-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: -0.03em;
        }
        .master-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
        }
        .master-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .master-input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0 12px;
        }
        .master-input-wrap:focus-within {
          border-color: var(--accent);
        }
        .master-input-wrap input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          padding: 9px 0;
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
        }
        .master-input-wrap input:focus { border: none; }
        .master-eye {
          background: none;
          color: var(--text-secondary);
          padding: 0;
          display: flex;
          cursor: pointer;
          border: none;
        }
        .master-eye:hover { color: var(--text-primary); }
        .master-error { color: var(--danger); font-size: 12px; margin-top: -8px; }
        .master-submit {
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
        .master-submit:hover { background: var(--accent-hover); }
        .master-spinner {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(13,27,40,0.3);
          border-top-color: #0d1b28;
          animation: spin 700ms linear infinite;
        }
        .master-hint {
          text-align: center;
          color: #52525b;
          font-size: 11px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
