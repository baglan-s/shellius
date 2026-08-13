import { ReactNode, useState } from 'react';

interface HostGroupProps {
  name: string;
  children: ReactNode;
}

export default function HostGroup({ name, children }: HostGroupProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="host-group-container">
      <div className="host-group-header" onClick={() => setExpanded(!expanded)}>
        <span className="host-group-arrow">{expanded ? '▼' : '▶'}</span>
        <span>{name}</span>
      </div>
      {expanded && <div className="host-group-items">{children}</div>}

      <style>{`
        .host-group-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 12px;
          color: var(--text-secondary);
          text-transform: uppercase;
        }
        .host-group-header:hover { color: var(--text-primary); }
        .host-group-arrow { font-size: 8px; }
        .host-group-items { padding-left: 8px; }
      `}</style>
    </div>
  );
}
