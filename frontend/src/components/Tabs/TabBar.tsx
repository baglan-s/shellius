import { useWS } from '../../contexts/WebSocketContext';
import { useSessionStore } from '../../stores/sessionStore';

export default function TabBar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeSessionId);
  const setActive = useSessionStore((s) => s.setActive);
  const removeSession = useSessionStore((s) => s.removeSession);
  const { send } = useWS();

  if (sessions.length === 0) return null;

  const handleClose = (id: string) => {
    send({ type: 'ssh.disconnect', session_id: id });
    removeSession(id);
  };

  return (
    <div className="tab-bar">
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

      <style>{`
        .tab-bar {
          display: flex;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          overflow-x: auto;
          min-height: 36px;
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
      `}</style>
    </div>
  );
}
