import { useState, useEffect, useCallback } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useI18n } from '../../i18n';

interface PortForward {
  localPort: number;
  remoteHost: string;
  remotePort: number;
  status: 'active' | 'stopped';
}

interface Props {
  sessionId: string;
  onClose: () => void;
}

export default function PortForwardPanel({ sessionId, onClose }: Props) {
  const { send, subscribe } = useWS();
  const { t } = useI18n();
  const [forwards, setForwards] = useState<PortForward[]>([]);
  const [localPort, setLocalPort] = useState('');
  const [remoteHost, setRemoteHost] = useState('localhost');
  const [remotePort, setRemotePort] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    send({ type: 'portforward.list', id: `pf-list-${Date.now()}`, session_id: sessionId });
  }, [send, sessionId]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'success' && msg.id?.startsWith('pf-start-')) {
        const p = msg.payload as any;
        setForwards((prev) => [
          ...prev,
          { localPort: p.local_port, remoteHost: p.remote_host, remotePort: p.remote_port, status: 'active' },
        ]);
        setLocalPort('');
        setRemotePort('');
        setError('');
      }
      if (msg.type === 'success' && msg.id?.startsWith('pf-stop-')) {
        const port = parseInt(msg.id.replace('pf-stop-', ''));
        setForwards((prev) => prev.filter((f) => f.localPort !== port));
      }
      if (msg.type === 'error' && msg.id?.startsWith('pf-')) {
        setError((msg.payload as any)?.message || 'Port forward failed');
      }
    });
  }, [subscribe]);

  const handleStart = useCallback(() => {
    const lp = parseInt(localPort);
    const rp = parseInt(remotePort);
    if (!lp || !rp || lp < 1 || lp > 65535 || rp < 1 || rp > 65535) {
      setError(t('portForward.invalidPort'));
      return;
    }
    if (forwards.some((f) => f.localPort === lp)) {
      setError(t('portForward.alreadyUsed'));
      return;
    }
    setError('');
    send({
      type: 'portforward.start',
      id: `pf-start-${Date.now()}`,
      session_id: sessionId,
      payload: { local_port: lp, remote_host: remoteHost || 'localhost', remote_port: rp },
    });
  }, [localPort, remoteHost, remotePort, sessionId, send, forwards, t]);

  const handleStop = useCallback(
    (port: number) => {
      send({
        type: 'portforward.stop',
        id: `pf-stop-${port}`,
        session_id: sessionId,
        payload: { local_port: port },
      });
    },
    [send, sessionId]
  );

  return (
    <div className="pf-panel">
      <div className="pf-header">
        <span className="pf-title">{t('portForward.title')}</span>
        <button className="pf-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="pf-form">
        <div className="pf-row">
          <input
            type="number"
            placeholder={t('portForward.localPort')}
            value={localPort}
            onChange={(e) => setLocalPort(e.target.value)}
            className="pf-input pf-input-port"
            min="1"
            max="65535"
          />
          <span className="pf-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
            </svg>
          </span>
          <input
            type="text"
            placeholder={t('portForward.remoteHost')}
            value={remoteHost}
            onChange={(e) => setRemoteHost(e.target.value)}
            className="pf-input pf-input-host"
          />
          <span className="pf-colon">:</span>
          <input
            type="number"
            placeholder={t('portForward.remotePort')}
            value={remotePort}
            onChange={(e) => setRemotePort(e.target.value)}
            className="pf-input pf-input-port"
            min="1"
            max="65535"
          />
        </div>
        <button className="pf-add-btn" onClick={handleStart}>
          {t('portForward.add')}
        </button>
        {error && <div className="pf-error">{error}</div>}
      </div>

      <div className="pf-list">
        {forwards.length === 0 && (
          <div className="pf-empty">{t('portForward.noForwards')}</div>
        )}
        {forwards.map((f) => (
          <div key={f.localPort} className="pf-item">
            <div className="pf-item-info">
              <span className="pf-item-dot" />
              <span className="pf-item-local">:{f.localPort}</span>
              <span className="pf-item-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
                </svg>
              </span>
              <span className="pf-item-remote">{f.remoteHost}:{f.remotePort}</span>
            </div>
            <button className="pf-stop-btn" onClick={() => handleStop(f.localPort)}>
              {t('portForward.stop')}
            </button>
          </div>
        ))}
      </div>

      <style>{`
        .pf-panel {
          width: 320px;
          flex: 0 0 320px;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .pf-header {
          height: 40px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
        }
        .pf-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .pf-close {
          background: none;
          color: var(--text-secondary);
          padding: 4px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
        }
        .pf-close:hover {
          color: var(--text-primary);
          background: var(--bg-surface);
        }
        .pf-form {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pf-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .pf-input {
          height: 30px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--bg-surface);
          color: var(--text-primary);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          padding: 0 8px;
        }
        .pf-input:focus {
          border-color: var(--accent);
          outline: none;
        }
        .pf-input-port {
          width: 60px;
          flex: 0 0 60px;
        }
        .pf-input-host {
          flex: 1;
          min-width: 0;
        }
        .pf-arrow, .pf-colon {
          color: var(--text-secondary);
          flex: 0 0 auto;
          display: flex;
          align-items: center;
        }
        .pf-colon {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
        }
        .pf-add-btn {
          height: 30px;
          background: var(--accent);
          color: #0d1b28;
          border: none;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .pf-add-btn:hover {
          opacity: 0.9;
        }
        .pf-error {
          font-size: 11px;
          color: var(--danger);
        }
        .pf-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px;
        }
        .pf-empty {
          color: var(--text-secondary);
          font-size: 12px;
          text-align: center;
          padding: 24px 0;
        }
        .pf-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          margin-bottom: 6px;
        }
        .pf-item-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--text-primary);
          min-width: 0;
        }
        .pf-item-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--success);
          flex: 0 0 6px;
        }
        .pf-item-local {
          color: var(--accent);
          font-weight: 600;
        }
        .pf-item-arrow {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
        }
        .pf-item-remote {
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pf-stop-btn {
          height: 22px;
          padding: 0 8px;
          font-size: 11px;
          background: none;
          color: var(--danger);
          border: 1px solid var(--danger);
          border-radius: var(--radius-sm);
          cursor: pointer;
          flex: 0 0 auto;
        }
        .pf-stop-btn:hover {
          background: var(--danger);
          color: #fff;
        }
        /* Hide number input arrows */
        .pf-input-port::-webkit-inner-spin-button,
        .pf-input-port::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .pf-input-port {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
