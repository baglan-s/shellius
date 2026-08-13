import { useEffect } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useSessionStore } from '../../stores/sessionStore';
import TabBar from '../Tabs/TabBar';
import TerminalView from '../Terminal/Terminal';

export default function MainArea() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setConnected = useSessionStore((s) => s.setConnected);
  const removeSession = useSessionStore((s) => s.removeSession);
  const { subscribe } = useWS();

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'success' && msg.session_id) {
        setConnected(msg.session_id, true);
      }
      if (msg.type === 'ssh.disconnect' && msg.session_id) {
        setConnected(msg.session_id, false);
      }
      if (msg.type === 'error' && msg.id?.startsWith('session-')) {
        // Connection failed — remove the session tab
        removeSession(msg.id);
      }
    });
  }, [subscribe, setConnected, removeSession]);

  return (
    <div className="main-area">
      <TabBar />
      <div className={`terminal-area ${sessions.length > 0 ? 'has-session' : ''}`}>
        {sessions.map((session) => (
          <div
            key={session.id}
            style={{
              display: session.id === activeSessionId ? 'flex' : 'none',
              flex: 1,
              width: '100%',
            }}
          >
            <TerminalView sessionId={session.id} />
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="empty-state">
            <div className="empty-title">Welcome to Shellius</div>
            <div className="empty-hint">
              Use Quick Connect or add a host to get started
            </div>
          </div>
        )}
      </div>

      <style>{`
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .terminal-area {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .terminal-area.has-session {
          align-items: stretch;
          justify-content: stretch;
        }
        .empty-state {
          text-align: center;
        }
        .empty-title {
          font-size: 20px;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .empty-hint {
          color: var(--text-secondary);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
