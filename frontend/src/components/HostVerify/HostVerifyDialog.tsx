import { useI18n } from '../../i18n';

interface HostVerifyDialogProps {
  hostname: string;
  port: number;
  fingerprint: string;
  keyType: string;
  status: 'new' | 'changed';
  oldFingerprint?: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function HostVerifyDialog({
  hostname, port, fingerprint, keyType, status, oldFingerprint, onAccept, onReject,
}: HostVerifyDialogProps) {
  const { t } = useI18n();

  return (
    <div className="hv-overlay">
      <div className="hv-dialog">
        <div className="hv-icon">
          {status === 'changed' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        <div className="hv-title">
          {status === 'changed' ? t('hostVerify.changed') : t('hostVerify.new')}
        </div>

        <div className="hv-host">
          {hostname}:{port}
        </div>

        {status === 'changed' && (
          <div className="hv-warning">{t('hostVerify.warning')}</div>
        )}

        <div className="hv-details">
          <div className="hv-row">
            <span className="hv-label">{t('hostVerify.keyType')}</span>
            <code className="hv-value">{keyType}</code>
          </div>
          <div className="hv-row">
            <span className="hv-label">{t('hostVerify.fingerprint')}</span>
            <code className="hv-value hv-fp">SHA256:{fingerprint}</code>
          </div>
          {status === 'changed' && oldFingerprint && (
            <div className="hv-row">
              <span className="hv-label">{t('hostVerify.oldFingerprint')}</span>
              <code className="hv-value hv-fp hv-old">SHA256:{oldFingerprint}</code>
            </div>
          )}
        </div>

        <div className="hv-actions">
          <button className="hv-btn hv-accept" onClick={onAccept}>
            {t('hostVerify.accept')}
          </button>
          <button className="hv-btn hv-reject" onClick={onReject}>
            {t('hostVerify.reject')}
          </button>
        </div>
      </div>

      <style>{`
        .hv-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadein 150ms ease;
        }
        .hv-dialog {
          width: 420px;
          padding: 24px;
          background: var(--bg-primary);
          border-radius: 12px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.5);
        }
        .hv-icon { margin-bottom: 2px; }
        .hv-title {
          font-size: 16px;
          font-weight: 600;
          text-align: center;
        }
        .hv-host {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          color: var(--accent);
          background: var(--bg-surface);
          padding: 6px 14px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
        }
        .hv-warning {
          font-size: 12px;
          color: var(--danger);
          text-align: center;
          line-height: 1.4;
          padding: 8px 12px;
          background: var(--danger-bg);
          border-radius: var(--radius-sm);
          width: 100%;
        }
        .hv-details {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: var(--bg-surface);
          border-radius: var(--radius);
          border: 1px solid var(--border);
        }
        .hv-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .hv-label {
          font-size: 11px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .hv-value {
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-primary);
          word-break: break-all;
        }
        .hv-fp { font-size: 11px; }
        .hv-old { color: var(--danger); text-decoration: line-through; }
        .hv-actions {
          display: flex;
          gap: 8px;
          width: 100%;
          margin-top: 4px;
        }
        .hv-btn {
          flex: 1;
          height: 36px;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .hv-accept {
          background: var(--accent);
          color: #0d1b28;
        }
        .hv-accept:hover { background: var(--accent-hover); }
        .hv-reject {
          background: var(--bg-surface);
          color: var(--text-primary);
          border: 1px solid var(--border);
        }
        .hv-reject:hover { background: var(--bg-surface-hover); }
      `}</style>
    </div>
  );
}
