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

  if (sessions.length === 0) return null;

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
              x
            </button>
          </div>
        ))}
      </div>

      {activeSession?.connected && onToggleFiles && (
        <button
          className={`tab-files-btn ${showFiles ? 'active' : ''}`}
          onClick={onToggleFiles}
          title={t('sftp.open')}
        >
          {t('sftp.open')}
        </button>
      )}

      <style>{`
        .tab-bar {
          display: flex;
          align-items: center;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          min-height: 36px;
        }
        .tab-list {
          display: flex;
          flex: 1;
          overflow-x: auto;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          color: var(--text-secondary);
          cursor: pointer;
          border-right: 1px solid var(--border);
          font-size: 13px;
          white-space: nowrap;
        }
        .tab.active {
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .tab-status {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .tab-status.on { background: var(--success); }
        .tab-status.off { background: var(--danger); }
        .tab-close {
          background: none;
          color: var(--text-secondary);
          padding: 2px 4px;
          font-size: 11px;
          border-radius: 4px;
        }
        .tab-close:hover {
          background: var(--danger);
          color: white;
        }
        .tab-files-btn {
          padding: 5px 12px;
          margin: 0 8px;
          font-size: 11px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          border-radius: 4px;
          white-space: nowrap;
        }
        .tab-files-btn:hover { color: var(--text-primary); }
        .tab-files-btn.active {
          background: var(--accent);
          color: var(--bg-primary);
        }
      `}</style>
    </div>
  );
}
