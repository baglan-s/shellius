import { useState } from 'react';

interface VaultFormProps {
  onSave: (entry: {
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    category: string;
  }) => void;
  onCancel: () => void;
}

export default function VaultForm({ onSave, onCancel }: VaultFormProps) {
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('general');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title, username, password, url, notes, category });
  };

  return (
    <form onSubmit={handleSubmit} className="vault-form">
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input placeholder="Username / Email" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="general">General</option>
        <option value="social">Social</option>
        <option value="finance">Finance</option>
        <option value="work">Work</option>
        <option value="dev">Development</option>
      </select>
      <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

      <div className="vault-form-actions">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>

      <style>{`
        .vault-form { display: flex; flex-direction: column; gap: 10px; }
        .vault-form input, .vault-form textarea, .vault-form select { width: 100%; }
        .vault-form select {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 8px 12px;
          color: var(--text-primary); font-size: 14px;
        }
        .vault-form-actions { display: flex; gap: 8px; }
      `}</style>
    </form>
  );
}
