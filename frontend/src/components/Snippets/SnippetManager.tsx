import { useState } from 'react';

interface Snippet {
  id: string;
  label: string;
  command: string;
  description: string;
}

interface SnippetManagerProps {
  snippets: Snippet[];
  onExecute: (command: string) => void;
  onAdd: (snippet: { label: string; command: string; description: string }) => void;
  onDelete: (id: string) => void;
}

export default function SnippetManager({ snippets, onExecute, onAdd, onDelete }: SnippetManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    onAdd({ label, command, description });
    setLabel('');
    setCommand('');
    setDescription('');
    setShowForm(false);
  };

  return (
    <div className="snippet-manager">
      <button className="primary" onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Cancel' : '+ Add Snippet'}
      </button>

      {showForm && (
        <div className="snippet-form">
          <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input placeholder="Command" value={command} onChange={(e) => setCommand(e.target.value)} />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="primary" onClick={handleAdd}>Save</button>
        </div>
      )}

      <div className="snippet-list">
        {snippets.map((s) => (
          <div key={s.id} className="snippet-item">
            <div className="snippet-info">
              <span className="snippet-label">{s.label}</span>
              <code className="snippet-cmd">{s.command}</code>
            </div>
            <div className="snippet-actions">
              <button onClick={() => onExecute(s.command)}>Run</button>
              <button onClick={() => onDelete(s.id)}>Del</button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .snippet-manager { display: flex; flex-direction: column; gap: 12px; }
        .snippet-form { display: flex; flex-direction: column; gap: 8px; }
        .snippet-form input { width: 100%; }
        .snippet-list { display: flex; flex-direction: column; gap: 4px; }
        .snippet-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px; border-radius: var(--radius); background: var(--bg-surface);
        }
        .snippet-info { display: flex; flex-direction: column; gap: 2px; }
        .snippet-label { font-size: 13px; }
        .snippet-cmd { font-size: 12px; color: var(--accent); }
        .snippet-actions { display: flex; gap: 4px; }
        .snippet-actions button { padding: 4px 8px; font-size: 11px; background: var(--bg-secondary); color: var(--text-secondary); }
      `}</style>
    </div>
  );
}
