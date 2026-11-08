import { useState } from 'react';
import { useHostStore, Host } from '../../stores/hostStore';
import { useI18n } from '../../i18n';

interface HostListProps {
  onConnect: (host: Host) => void;
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
}

export default function HostList({ onConnect, onEdit, onDelete }: HostListProps) {
  const hosts = useHostStore((s) => s.hosts);
  const selectedId = useHostStore((s) => s.selectedHostId);
  const selectHost = useHostStore((s) => s.selectHost);
  const { t } = useI18n();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
              <div className="host-actions">
                {deleteConfirmId === host.id ? (
                  <div className="host-delete-confirm">
                    <span className="host-delete-text">{t('hosts.deleteConfirm')}</span>
                    <button
                      className="host-action-btn host-action-del"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(host);
                        setDeleteConfirmId(null);
                      }}
                    >
                      {t('common.delete')}
                    </button>
                    <button
                      className="host-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(null);
                      }}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="host-action-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(host);
                      }}
                      title={t('hosts.edit')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      className="host-action-icon host-action-del-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(host.id);
                      }}
                      title={t('hosts.delete')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                    <button
                      className="host-connect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnect(host);
                      }}
                      title={t('hosts.connect')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
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
          letter-spacing: 0.05em;
        }
        .host-item {
          padding: 10px 12px;
          border-radius: var(--radius);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-left: 2px solid transparent;
        }
        .host-item:hover { background: var(--bg-surface-hover); }
        .host-item:hover .host-actions { opacity: 1; }
        .host-item.selected { border-left-color: var(--accent); }
        .host-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .host-label { font-size: 13px; font-weight: 600; }
        .host-addr {
          font-size: 12px; color: var(--text-secondary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
        }
        .host-actions {
          opacity: 0;
          display: flex;
          gap: 4px;
          flex-shrink: 0;
          transition: opacity 150ms ease;
        }
        .host-action-icon {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          color: var(--text-secondary);
          padding: 0;
          border: 1px solid var(--border);
        }
        .host-action-icon:hover { background: var(--border); color: var(--text-primary); }
        .host-action-del-icon:hover { background: var(--danger-bg); color: var(--danger); border-color: transparent; }
        .host-connect-btn {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: #0d1b28;
          padding: 0;
        }
        .host-connect-btn:hover { background: var(--accent-hover); }
        .host-action-btn {
          padding: 3px 8px;
          font-size: 11px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
        }
        .host-action-btn:hover { color: var(--text-primary); }
        .host-action-del { color: var(--danger); }
        .host-action-del:hover { background: var(--danger); color: white; }
        .host-delete-confirm {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .host-delete-text {
          font-size: 11px;
          color: var(--danger);
          white-space: nowrap;
        }
        .host-empty { color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px; }
      `}</style>
    </div>
  );
}
