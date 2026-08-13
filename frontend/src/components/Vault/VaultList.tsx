import { useState } from 'react';

interface VaultEntry {
  id: string;
  title: string;
  username: string;
  url: string;
  category: string;
}

interface VaultListProps {
  entries: VaultEntry[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export default function VaultList({ entries, onSelect, onAdd }: VaultListProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const categories = ['all', ...new Set(entries.map((e) => e.category))];

  const filtered = entries.filter((e) => {
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'all' || e.category === category;
    return matchSearch && matchCategory;
  });

  return (
    <div className="vault-list">
      <div className="vault-toolbar">
        <input
          placeholder="Search vault..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="vault-search"
        />
        <button className="primary" onClick={onAdd}>+</button>
      </div>

      <div className="vault-categories">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`vault-cat ${cat === category ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="vault-items">
        {filtered.map((entry) => (
          <div key={entry.id} className="vault-item" onClick={() => onSelect(entry.id)}>
            <div className="vault-item-title">{entry.title}</div>
            <div className="vault-item-user">{entry.username}</div>
          </div>
        ))}
      </div>

      <style>{`
        .vault-list { display: flex; flex-direction: column; gap: 8px; }
        .vault-toolbar { display: flex; gap: 8px; }
        .vault-search { flex: 1; }
        .vault-categories { display: flex; gap: 4px; flex-wrap: wrap; }
        .vault-cat {
          padding: 4px 10px; font-size: 11px; background: var(--bg-surface);
          color: var(--text-secondary); border-radius: 12px;
        }
        .vault-cat.active { background: var(--accent); color: var(--bg-primary); }
        .vault-items { display: flex; flex-direction: column; gap: 4px; }
        .vault-item {
          padding: 10px 12px; border-radius: var(--radius); cursor: pointer;
          background: var(--bg-surface);
        }
        .vault-item:hover { border-left: 2px solid var(--accent); }
        .vault-item-title { font-size: 14px; }
        .vault-item-user { font-size: 12px; color: var(--text-secondary); }
      `}</style>
    </div>
  );
}
