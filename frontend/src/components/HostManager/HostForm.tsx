import { useState } from 'react';

interface HostFormProps {
  onSave: (host: {
    label: string;
    hostname: string;
    port: number;
    username: string;
    authMethod: string;
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
  const [groupName, setGroupName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ label, hostname, port, username, authMethod, groupName });
  };

  return (
    <form onSubmit={handleSubmit} className="host-form">
      <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <input placeholder="Hostname / IP" value={hostname} onChange={(e) => setHostname(e.target.value)} required />
      <input type="number" placeholder="Port" value={port} onChange={(e) => setPort(Number(e.target.value))} />
      <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value)}>
        <option value="password">Password</option>
        <option value="key">SSH Key</option>
      </select>
      <input placeholder="Group (optional)" value={groupName} onChange={(e) => setGroupName(e.target.value)} />

      <div className="host-form-actions">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
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
      `}</style>
    </form>
  );
}
