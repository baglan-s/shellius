interface VaultSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function VaultSearch({ value, onChange }: VaultSearchProps) {
  return (
    <div className="vault-search-container">
      <input
        type="text"
        placeholder="Search passwords..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="vault-search-input"
      />

      <style>{`
        .vault-search-container { width: 100%; }
        .vault-search-input {
          width: 100%; padding: 10px 14px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-primary);
          font-size: 14px;
        }
        .vault-search-input:focus { border-color: var(--accent); }
      `}</style>
    </div>
  );
}
