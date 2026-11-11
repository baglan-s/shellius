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
import VaultManager from '../Vault/VaultManager';
import SettingsModal from '../Settings/SettingsModal';

type Tab = 'hosts' | 'quick' | 'keys' | 'snippets' | 'vault';

const TAB_ICONS: Record<Tab, JSX.Element> = {
  hosts: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18v11H3z" /><path d="M9 20h6" /><path d="M12 16v4" />
    </svg>
  ),
  quick: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  ),
  keys: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 7a4 4 0 1 1-3.5 5.9L4 20l-1-3 2-2 1 1 1.5-1.5" /><path d="M17 7h.01" />
    </svg>
  ),
  snippets: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 8l-4 4 4 4" /><path d="M15 8l4 4-4 4" />
    </svg>
  ),
  vault: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h16v10H4z" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
};

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

  useEffect(() => {
    if (connected) {
      send({ type: 'host.list' });
    }
  }, [connected, send]);

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

  const tabs: Tab[] = ['hosts', 'quick', 'keys', 'snippets', 'vault'];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">Shellcat</h1>
        <div className="sidebar-header-right">
          <button className="settings-gear" onClick={() => setShowSettings(true)} title={t('settings.title')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
        </div>
      </div>

      <nav className="sidebar-nav">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`sidebar-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            title={t(`tab.${tab}`)}
          >
            {TAB_ICONS[tab]}
            <span>{t(`tab.${tab}`)}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-content">
        {activeTab === 'hosts' && (
          <>
            <button
              className="primary"
              style={{ width: '100%', marginBottom: 12, height: 32, fontSize: 12 }}
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
        {activeTab === 'vault' && <VaultManager />}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <style>{`
        .sidebar {
          width: 280px;
          flex: 0 0 280px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .sidebar-header {
          height: 48px;
          flex: 0 0 48px;
          padding: 0 14px;
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
          border-radius: var(--radius-sm);
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
          letter-spacing: -0.02em;
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
          padding: 0 4px;
        }
        .sidebar-tab {
          flex: 1;
          padding: 8px 2px;
          background: none;
          color: var(--text-secondary);
          font-size: 10px;
          border-radius: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          border-bottom: 2px solid transparent;
        }
        .sidebar-tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
        .sidebar-tab:hover {
          color: var(--text-primary);
        }
        .sidebar-content {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
          min-height: 0;
        }
      `}</style>
    </div>
  );
}
