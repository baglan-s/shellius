import { useState, useEffect } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useKeyStore } from '../../stores/keyStore';

interface HostFormProps {
  onSave: (host: {
    label: string;
    hostname: string;
    port: number;
    username: string;
    authMethod: string;
    password?: string;
    keyId?: string;
    groupName: string;
  }) => void;
  onCancel: () => void;
}

export default function HostForm({ onSave, onCancel }: HostFormProps) {
  const [label, setLabel] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authMethod, setAuthMethod] = useState('password');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState('');
  const [groupName, setGroupName] = useState('');
  const { send, subscribe } = useWS();
  const keys = useKeyStore((s) => s.keys);
  const setKeys = useKeyStore((s) => s.setKeys);

  // Load keys if not loaded
  useEffect(() => {
    send({ type: 'key.list' });
  }, [send]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'key.list' && Array.isArray(msg.payload)) {
        setKeys(msg.payload);
      }
    });
  }, [subscribe, setKeys]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      label,
      hostname,
      port,
      username,
      authMethod,
      password: authMethod === 'password' ? password : undefined,
      keyId: authMethod === 'key' ? keyId : undefined,
      groupName,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="host-form" autoComplete="off">
      <input
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        required
        autoComplete="off"
      />
      <input
        placeholder="Hostname / IP"
        value={hostname}
        onChange={(e) => setHostname(e.target.value)}
        required
        autoComplete="off"
      />
      <input
        type="number"
        placeholder="Port"
        value={port}
        onChange={(e) => setPort(Number(e.target.value))}
        autoComplete="off"
      />
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="off"
      />

      <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value)}>
        <option value="password">Password</option>
        <option value="key">SSH Key</option>
      </select>

      {authMethod === 'password' && (
        <input
          type="password"
          placeholder="Password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
        />
      )}

      {authMethod === 'key' && (
        <>
          <select
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            required
          >
            <option value="">-- Select SSH Key --</option>
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          {keys.length === 0 && (
            <div className="host-form-hint">
              No keys available. Go to Keys tab to generate or import one.
            </div>
          )}
        </>
      )}

      <input
        placeholder="Group (optional)"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />

      <div className="host-form-actions">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <style>{`
        .host-form { display: flex; flex-direction: column; gap: 10px; }
        .host-form input, .host-form select { width: 100%; }
        .host-form select {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 8px 12px;
          color: var(--text-primary);
          font-size: 14px;
        }
        .host-form-actions { display: flex; gap: 8px; }
        .host-form-hint {
          font-size: 11px;
          color: var(--danger);
          margin-top: -4px;
        }
      `}</style>
    </form>
  );
}
