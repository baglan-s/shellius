import { useState } from 'react';

interface QuickConnectProps {
  onConnect: (data: {
    hostname: string;
    port: number;
    username: string;
    password: string;
  }) => void;
}

export default function QuickConnect({ onConnect }: QuickConnectProps) {
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname) return;
    onConnect({ hostname, port, username, password });
  };

  return (
    <form onSubmit={handleSubmit} className="quick-connect">
      <h3 className="qc-title">Quick Connect</h3>
      <input
        placeholder="Hostname / IP"
        value={hostname}
        onChange={(e) => setHostname(e.target.value)}
        required
      />
      <input
        type="number"
        placeholder="Port"
        value={port}
        onChange={(e) => setPort(Number(e.target.value))}
      />
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" className="primary" style={{ width: '100%' }}>
        Connect
      </button>

      <style>{`
        .quick-connect {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .qc-title {
          font-size: 14px;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .quick-connect input {
          width: 100%;
        }
      `}</style>
    </form>
  );
}
