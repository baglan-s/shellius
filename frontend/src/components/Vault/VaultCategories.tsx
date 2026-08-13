interface VaultCategoriesProps {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
}

export default function VaultCategories({ categories, active, onSelect }: VaultCategoriesProps) {
  return (
    <div className="vault-categories-list">
      {categories.map((cat) => (
        <button
          key={cat}
          className={`vault-category-btn ${cat === active ? 'active' : ''}`}
          onClick={() => onSelect(cat)}
        >
          {cat}
        </button>
      ))}

      <style>{`
        .vault-categories-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .vault-category-btn {
          padding: 6px 14px; font-size: 12px; border-radius: 16px;
          background: var(--bg-surface); color: var(--text-secondary);
        }
        .vault-category-btn.active {
          background: var(--accent); color: var(--bg-primary);
        }
        .vault-category-btn:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}
