import { useWS } from '../../contexts/WebSocketContext';
import { useSessionStore } from '../../stores/sessionStore';
import { useI18n } from '../../i18n';

interface TabBarProps {
  showFiles?: boolean;
  onToggleFiles?: () => void;
}

export default function TabBar({ showFiles, onToggleFiles }: TabBarProps) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeSessionId);
  const setActive = useSessionStore((s) => s.setActive);
  const removeSession = useSessionStore((s) => s.removeSession);
  const { send } = useWS();
  const { t } = useI18n();

  const handleClose = (id: string) => {
    send({ type: 'ssh.disconnect', session_id: id });
    removeSession(id);
  };

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`tab ${session.id === activeId ? 'active' : ''}`}
            onClick={() => setActive(session.id)}
          >
            <span className={`tab-status ${session.connected ? 'on' : 'off'}`} />
            <span className="tab-label">{session.label}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                handleClose(session.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {activeSession?.connected && onToggleFiles && (
        <div className="tab-bar-right">
          <button
            className={`tab-files-btn ${showFiles ? 'active' : ''}`}
            onClick={onToggleFiles}
            title={t('sftp.open')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1" />
              <path d="M2.5 12.5A1.5 1.5 0 0 1 4 11h16.5a1 1 0 0 1 1 1.2l-1.3 6A2 2 0 0 1 18.2 20H5.3a2 2 0 0 1-2-1.7Z" />
            </svg>
            Files
          </button>
        </div>
      )}

      <style>{`
        .tab-bar {
          height: 40px;
          flex: 0 0 40px;
          display: flex;
          align-items: stretch;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          padding-right: 8px;
        }
        .tab-list {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: stretch;
          overflow-x: auto;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          cursor: pointer;
          border-right: 1px solid var(--border);
          max-width: 220px;
          background: transparent;
        }
        .tab.active {
          background: var(--bg-primary);
        }
        .tab-status {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex: 0 0 6px;
        }
        .tab-status.on { background: var(--success); }
        .tab-status.off { background: var(--danger); }
        .tab-label {
          font-size: 13px;
          color: var(--text-secondary);
          font-family: 'JetBrains Mono', monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tab.active .tab-label {
          color: var(--text-primary);
        }
        .tab-close {
          font-size: 11px;
          color: var(--text-secondary);
          width: 16px;
          height: 16px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 16px;
          background: none;
          padding: 0;
        }
        .tab-close:hover {
          background: var(--danger);
          color: #fff;
        }
        .tab-bar-right {
          display: flex;
          align-items: center;
        }
        .tab-files-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 26px;
          padding: 0 10px;
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          background: var(--bg-surface);
          color: var(--text-secondary);
          border: none;
        }
        .tab-files-btn:hover {
          color: var(--text-primary);
          background: var(--bg-surface-hover);
        }
        .tab-files-btn.active {
          background: var(--accent);
          color: #0d1b28;
        }
      `}</style>
    </div>
  );
}
