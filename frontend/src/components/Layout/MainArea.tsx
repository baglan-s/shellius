import { useEffect, useState } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useSessionStore } from '../../stores/sessionStore';
import { useI18n } from '../../i18n';
import TabBar from '../Tabs/TabBar';
import TerminalView from '../Terminal/Terminal';
import FileManager from '../FileManager/FileManager';

export default function MainArea() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setConnected = useSessionStore((s) => s.setConnected);
  const removeSession = useSessionStore((s) => s.removeSession);
  const { subscribe } = useWS();
  const { t } = useI18n();
  const [showFiles, setShowFiles] = useState(false);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'success' && msg.session_id) {
        setConnected(msg.session_id, true);
      }
      if (msg.type === 'ssh.disconnect' && msg.session_id) {
        setConnected(msg.session_id, false);
      }
      if (msg.type === 'error' && msg.id?.startsWith('session-')) {
        removeSession(msg.id);
      }
    });
  }, [subscribe, setConnected, removeSession]);

  // Close files panel when session disconnects or changes
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const filesVisible = showFiles && activeSession?.connected && activeSessionId;

  return (
    <div className="main-area">
      <TabBar
        showFiles={showFiles}
        onToggleFiles={() => setShowFiles(!showFiles)}
      />
      <div className={`terminal-area ${sessions.length > 0 ? 'has-session' : ''}`}>
        <div className="terminal-pane">
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
              <div className="empty-title">{t('welcome.title')}</div>
              <div className="empty-hint">{t('welcome.hint')}</div>
            </div>
          )}
        </div>
        {filesVisible && activeSessionId && (
          <FileManager
            sessionId={activeSessionId}
            onClose={() => setShowFiles(false)}
          />
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
        .terminal-pane {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        .empty-state {
          text-align: center;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
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
