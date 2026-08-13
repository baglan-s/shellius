import { useHostStore, Host } from '../../stores/hostStore';
import { useI18n } from '../../i18n';

interface HostListProps {
  onConnect: (host: Host) => void;
}

export default function HostList({ onConnect }: HostListProps) {
  const hosts = useHostStore((s) => s.hosts);
  const selectedId = useHostStore((s) => s.selectedHostId);
  const selectHost = useHostStore((s) => s.selectHost);
  const { t } = useI18n();

  const groups = hosts.reduce<Record<string, Host[]>>((acc, host) => {
    const group = host.group_name || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(host);
    return acc;
  }, {});

  return (
    <div className="host-list">
      {Object.entries(groups).map(([group, groupHosts]) => (
        <div key={group} className="host-group">
          <div className="host-group-name">{group}</div>
          {groupHosts.map((host) => (
            <div
              key={host.id}
              className={`host-item ${host.id === selectedId ? 'selected' : ''}`}
              onClick={() => selectHost(host.id)}
              onDoubleClick={() => onConnect(host)}
            >
              <div className="host-info">
                <span className="host-label">{host.label}</span>
                <span className="host-addr">
                  {host.username}@{host.hostname}:{host.port}
                </span>
              </div>
              <button
                className="host-connect-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnect(host);
                }}
              >
                {t('hosts.connect')}
              </button>
            </div>
          ))}
        </div>
      ))}

      {hosts.length === 0 && (
        <div className="host-empty">
          {t('hosts.noHosts')}
        </div>
      )}

      <style>{`
        .host-list { display: flex; flex-direction: column; gap: 4px; }
        .host-group-name {
          font-size: 11px;
          color: var(--text-secondary);
          text-transform: uppercase;
          padding: 8px 0 4px;
        }
        .host-item {
          padding: 8px 12px;
          border-radius: var(--radius);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .host-item:hover { background: var(--bg-surface); }
        .host-item:hover .host-connect-btn { opacity: 1; }
        .host-item.selected { background: var(--bg-surface); border-left: 2px solid var(--accent); }
        .host-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .host-label { font-size: 14px; }
        .host-addr { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .host-connect-btn {
          opacity: 0;
          padding: 4px 10px;
          font-size: 11px;
          background: var(--accent);
          color: var(--bg-primary);
          border-radius: 4px;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .host-connect-btn:hover { background: var(--accent-hover); }
        .host-empty { color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px; }
      `}</style>
    </div>
  );
}
