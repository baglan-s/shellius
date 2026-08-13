import { useState, useEffect, useCallback } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useHostStore, Host } from '../../stores/hostStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useI18n } from '../../i18n';
import HostList from '../HostManager/HostList';
import HostForm from '../HostManager/HostForm';
import QuickConnect from '../HostManager/QuickConnect';
import KeyManager from '../KeyManager/KeyManager';
import SnippetManager from '../SnippetManager/SnippetManager';
import SettingsModal from '../Settings/SettingsModal';

type Tab = 'hosts' | 'quick' | 'keys' | 'snippets' | 'vault';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<Tab>('hosts');
  const [showHostForm, setShowHostForm] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { send, subscribe, connected } = useWS();
  const { t } = useI18n();
  const setHosts = useHostStore((s) => s.setHosts);
  const addHost = useHostStore((s) => s.addHost);
  const updateHost = useHostStore((s) => s.updateHost);
  const removeHost = useHostStore((s) => s.removeHost);
  const addSession = useSessionStore((s) => s.addSession);

  // Load hosts on connect
  useEffect(() => {
    if (connected) {
      send({ type: 'host.list' });
    }
  }, [connected, send]);

  // Handle WS messages
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'host.list' && Array.isArray(msg.payload)) {
        setHosts(msg.payload);
      }
      if (msg.type === 'success' && msg.id?.startsWith('create-host-')) {
        addHost(msg.payload as Host);
      }
      if (msg.type === 'success' && msg.id?.startsWith('update-host-')) {
        updateHost(msg.payload as Host);
      }
      if (msg.type === 'success' && msg.id?.startsWith('delete-host-')) {
        const id = msg.id.replace('delete-host-', '');
        removeHost(id);
      }
    });
  }, [subscribe, setHosts, addHost, updateHost, removeHost]);

  const handleConnect = useCallback(
    (host: Host) => {
      const sessionId = `session-${Date.now()}`;
      addSession({
        id: sessionId,
        hostId: host.id,
        label: host.label || `${host.username}@${host.hostname}`,
        connected: false,
      });
      send({
        type: 'ssh.connect',
        id: sessionId,
        session_id: sessionId,
        payload: { host_id: host.id },
      });
    },
    [send, addSession]
  );

  const handleQuickConnect = useCallback(
    (data: { hostname: string; port: number; username: string; password: string }) => {
      const sessionId = `session-${Date.now()}`;
      addSession({
        id: sessionId,
        label: `${data.username}@${data.hostname}`,
        connected: false,
      });
      send({
        type: 'ssh.connect',
        id: sessionId,
        session_id: sessionId,
        payload: {
          hostname: data.hostname,
          port: data.port,
          username: data.username,
          auth_method: 'password',
          password: data.password,
        },
      });
    },
    [send, addSession]
  );

  const handleSaveHost = useCallback(
    (host: {
      id?: string;
      label: string;
      hostname: string;
      port: number;
      username: string;
      authMethod: string;
      password?: string;
      keyId?: string;
      groupName: string;
    }) => {
      if (host.id) {
        const msgId = `update-host-${Date.now()}`;
        send({
          type: 'host.update',
          id: msgId,
          payload: {
            id: host.id,
            label: host.label,
            hostname: host.hostname,
            port: host.port,
            username: host.username,
            auth_method: host.authMethod,
            password_enc: host.password,
            key_id: host.keyId,
            group_name: host.groupName,
          },
        });
      } else {
        const msgId = `create-host-${Date.now()}`;
        send({
          type: 'host.create',
          id: msgId,
          payload: {
            label: host.label,
            hostname: host.hostname,
            port: host.port,
            username: host.username,
            auth_method: host.authMethod,
            password_enc: host.password,
            key_id: host.keyId,
            group_name: host.groupName,
          },
        });
      }
      setShowHostForm(false);
      setEditingHost(null);
    },
    [send]
  );

  const handleEditHost = useCallback((host: Host) => {
    setEditingHost(host);
    setShowHostForm(true);
  }, []);

  const handleDeleteHost = useCallback(
    (host: Host) => {
      send({
        type: 'host.delete',
        id: `delete-host-${host.id}`,
        payload: { id: host.id },
      });
    },
    [send]
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">Shellius</h1>
        <div className="sidebar-header-right">
          <button className="settings-gear" onClick={() => setShowSettings(true)} title={t('settings.title')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.421-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
            </svg>
          </button>
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-tab ${activeTab === 'hosts' ? 'active' : ''}`}
          onClick={() => setActiveTab('hosts')}
        >
          {t('tab.hosts')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'quick' ? 'active' : ''}`}
          onClick={() => setActiveTab('quick')}
        >
          {t('tab.quick')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          {t('tab.keys')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'snippets' ? 'active' : ''}`}
          onClick={() => setActiveTab('snippets')}
        >
          {t('tab.snippets')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          {t('tab.vault')}
        </button>
      </nav>

      <div className="sidebar-content">
        {activeTab === 'hosts' && (
          <>
            <button
              className="primary"
              style={{ width: '100%', marginBottom: 12 }}
              onClick={() => {
                setShowHostForm(!showHostForm);
                setEditingHost(null);
              }}
            >
              {showHostForm ? t('hosts.cancel') : t('hosts.addHost')}
            </button>
            {showHostForm ? (
              <HostForm
                onSave={handleSaveHost}
                onCancel={() => {
                  setShowHostForm(false);
                  setEditingHost(null);
                }}
                editHost={editingHost || undefined}
              />
            ) : (
              <HostList
                onConnect={handleConnect}
                onEdit={handleEditHost}
                onDelete={handleDeleteHost}
              />
            )}
          </>
        )}
        {activeTab === 'quick' && <QuickConnect onConnect={handleQuickConnect} />}
        {activeTab === 'keys' && <KeyManager />}
        {activeTab === 'snippets' && <SnippetManager />}
        {activeTab === 'vault' && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('vault.comingSoon')}</div>}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <style>{`
        .sidebar {
          width: 280px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
        }
        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sidebar-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .settings-gear {
          background: none;
          color: var(--text-secondary);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
        }
        .settings-gear:hover {
          color: var(--text-primary);
          background: var(--bg-surface);
        }
        .sidebar-logo {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-dot.online { background: var(--success); }
        .status-dot.offline { background: var(--danger); }
        .sidebar-nav {
          display: flex;
          border-bottom: 1px solid var(--border);
        }
        .sidebar-tab {
          flex: 1;
          padding: 10px 4px;
          background: none;
          color: var(--text-secondary);
          font-size: 11px;
          border-radius: 0;
        }
        .sidebar-tab.active {
          color: var(--accent);
          border-bottom: 2px solid var(--accent);
        }
        .sidebar-content {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}
