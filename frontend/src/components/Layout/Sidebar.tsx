import { useState, useEffect, useCallback } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useHostStore, Host } from '../../stores/hostStore';
import { useSessionStore } from '../../stores/sessionStore';
import HostList from '../HostManager/HostList';
import HostForm from '../HostManager/HostForm';
import QuickConnect from '../HostManager/QuickConnect';
import KeyManager from '../KeyManager/KeyManager';

type Tab = 'hosts' | 'quick' | 'keys' | 'snippets' | 'vault';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<Tab>('hosts');
  const [showAddHost, setShowAddHost] = useState(false);
  const { send, subscribe, connected } = useWS();
  const setHosts = useHostStore((s) => s.setHosts);
  const addHost = useHostStore((s) => s.addHost);
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
    });
  }, [subscribe, setHosts, addHost]);

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
      label: string;
      hostname: string;
      port: number;
      username: string;
      authMethod: string;
      password?: string;
      keyId?: string;
      groupName: string;
    }) => {
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
      setShowAddHost(false);
    },
    [send]
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">Shellius</h1>
        <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-tab ${activeTab === 'hosts' ? 'active' : ''}`}
          onClick={() => setActiveTab('hosts')}
        >
          Hosts
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'quick' ? 'active' : ''}`}
          onClick={() => setActiveTab('quick')}
        >
          Quick
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          Keys
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'snippets' ? 'active' : ''}`}
          onClick={() => setActiveTab('snippets')}
        >
          Snippets
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          Vault
        </button>
      </nav>

      <div className="sidebar-content">
        {activeTab === 'hosts' && (
          <>
            <button
              className="primary"
              style={{ width: '100%', marginBottom: 12 }}
              onClick={() => setShowAddHost(!showAddHost)}
            >
              {showAddHost ? 'Cancel' : '+ Add Host'}
            </button>
            {showAddHost ? (
              <HostForm
                onSave={handleSaveHost}
                onCancel={() => setShowAddHost(false)}
              />
            ) : (
              <HostList onConnect={handleConnect} />
            )}
          </>
        )}
        {activeTab === 'quick' && <QuickConnect onConnect={handleQuickConnect} />}
        {activeTab === 'keys' && <KeyManager />}
        {activeTab === 'snippets' && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Snippets coming soon</div>}
        {activeTab === 'vault' && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Vault coming soon</div>}
      </div>

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
