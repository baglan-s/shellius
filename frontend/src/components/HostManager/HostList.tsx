import { useHostStore, Host } from '../../stores/hostStore';

interface HostListProps {
  onConnect: (host: Host) => void;
}

export default function HostList({ onConnect }: HostListProps) {
  const hosts = useHostStore((s) => s.hosts);
  const selectedId = useHostStore((s) => s.selectedHostId);
  const selectHost = useHostStore((s) => s.selectHost);

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
              <span className="host-label">{host.label}</span>
              <span className="host-addr">
                {host.username}@{host.hostname}:{host.port}
              </span>
            </div>
          ))}
        </div>
      ))}

      {hosts.length === 0 && (
        <div className="host-empty">
          No hosts yet. Add one or use Quick Connect.
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
          flex-direction: column;
          gap: 2px;
        }
        .host-item:hover { background: var(--bg-surface); }
        .host-item.selected { background: var(--bg-surface); border-left: 2px solid var(--accent); }
        .host-label { font-size: 14px; }
        .host-addr { font-size: 12px; color: var(--text-secondary); }
        .host-empty { color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px; }
      `}</style>
    </div>
  );
}
