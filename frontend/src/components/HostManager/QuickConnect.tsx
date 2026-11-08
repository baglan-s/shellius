import { useState } from 'react';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname) return;
    onConnect({ hostname, port, username, password });
  };

  return (
    <form onSubmit={handleSubmit} className="quick-connect" autoComplete="off">
      <h3 className="qc-title">{t('quick.title')}</h3>
      <input
        placeholder={t('hosts.hostname')}
        value={hostname}
        onChange={(e) => setHostname(e.target.value)}
        required
        autoComplete="off"
      />
      <div className="qc-row">
        <input
          type="number"
          placeholder={t('hosts.port')}
          value={port}
          onChange={(e) => setPort(Number(e.target.value))}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        <input
          placeholder={t('hosts.username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="off"
          style={{ flex: 1 }}
        />
      </div>
      <input
        type="password"
        placeholder={t('hosts.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <button type="submit" className="primary" style={{ width: '100%', height: 32, fontSize: 12, fontWeight: 600 }}>
        {t('quick.connect')}
      </button>

      <style>{`
        .quick-connect {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .qc-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }
        .qc-row { display: flex; gap: 8px; }
        .quick-connect input {
          width: 100%;
        }
      `}</style>
    </form>
  );
}
