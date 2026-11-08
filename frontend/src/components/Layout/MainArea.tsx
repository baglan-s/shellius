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

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const filesVisible = showFiles && activeSession?.connected && activeSessionId;

  return (
    <div className="main-area">
      <TabBar
        showFiles={showFiles}
        onToggleFiles={() => setShowFiles(!showFiles)}
      />
      <div className="terminal-wrapper">
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
              <div className="empty-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5BB8F5" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M5 8l4 4-4 4" /><path d="M12 16h7" />
                </svg>
              </div>
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
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .terminal-wrapper {
          flex: 1;
          min-height: 0;
          display: flex;
        }
        .terminal-pane {
          flex: 1;
          min-width: 0;
          display: flex;
          overflow: hidden;
          background: var(--bg-primary);
          position: relative;
        }
        .empty-state {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .empty-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-surface);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 6px;
        }
        .empty-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .empty-hint {
          color: var(--text-secondary);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
