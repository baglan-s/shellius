import { useState, useEffect, useCallback } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useSnippetStore, Snippet } from '../../stores/snippetStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useI18n } from '../../i18n';

export default function SnippetManager() {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const { send, subscribe } = useWS();
  const snippets = useSnippetStore((s) => s.snippets);
  const setSnippets = useSnippetStore((s) => s.setSnippets);
  const addSnippet = useSnippetStore((s) => s.addSnippet);
  const removeSnippet = useSnippetStore((s) => s.removeSnippet);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { t } = useI18n();

  useEffect(() => {
    send({ type: 'snippet.list' });
  }, [send]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'snippet.list' && Array.isArray(msg.payload)) {
        setSnippets(msg.payload);
      }
      if (msg.type === 'success' && msg.id?.startsWith('create-snippet-')) {
        addSnippet(msg.payload as Snippet);
        setShowForm(false);
        setLabel('');
        setCommand('');
        setDescription('');
      }
      if (msg.type === 'success' && msg.id?.startsWith('del-snippet-')) {
        const id = msg.id.replace('del-snippet-', '');
        removeSnippet(id);
      }
    });
  }, [subscribe, setSnippets, addSnippet, removeSnippet]);

  const handleCreate = useCallback(() => {
    if (!label.trim() || !command.trim()) return;
    send({
      type: 'snippet.create',
      id: `create-snippet-${Date.now()}`,
      payload: { label, command, description },
    });
  }, [send, label, command, description]);

  const handleDelete = useCallback(
    (id: string) => {
      send({
        type: 'snippet.delete',
        id: `del-snippet-${id}`,
        payload: { id },
      });
    },
    [send]
  );

  const handleRun = useCallback(
    (snippet: Snippet) => {
      if (!activeSessionId) return;
      send({
        type: 'ssh.data',
        session_id: activeSessionId,
        payload: { data: snippet.command + '\n' },
      });
    },
    [send, activeSessionId]
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  return (
    <div className="snippet-manager">
      <button
        className="primary"
        style={{ width: '100%', marginBottom: 4, height: 32, fontSize: 12 }}
        onClick={() => setShowForm(!showForm)}
      >
        {showForm ? t('common.cancel') : t('snippets.add')}
      </button>

      {showForm && (
        <div className="snippet-form">
          <input
            placeholder={t('snippets.label')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoComplete="off"
          />
          <textarea
            placeholder={t('snippets.command')}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            rows={3}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, resize: 'none' }}
            autoComplete="off"
          />
          <input
            placeholder={t('snippets.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
          />
          <button className="primary" onClick={handleCreate} style={{ width: '100%', height: 30, fontSize: 12 }}>
            {t('common.save')}
          </button>
        </div>
      )}

      <div className="snippet-list">
        {snippets.map((snippet) => (
          <div key={snippet.id} className="snippet-item">
            <div className="snippet-label">{snippet.label}</div>
            <div className="snippet-command">{snippet.command}</div>
            {snippet.description && (
              <div className="snippet-desc">{snippet.description}</div>
            )}
            <div className="snippet-actions">
              {activeSessionId && (
                <button
                  className="snippet-btn snippet-btn-run"
                  onClick={() => handleRun(snippet)}
                >
                  {t('snippets.run')}
                </button>
              )}
              <button
                className="snippet-btn"
                onClick={() => handleCopy(snippet.command)}
              >
                {t('keys.copy')}
              </button>
              <button
                className="snippet-btn snippet-btn-del"
                onClick={() => handleDelete(snippet.id)}
              >
                {t('keys.delete')}
              </button>
            </div>
          </div>
        ))}
        {snippets.length === 0 && !showForm && (
          <div className="snippet-empty">{t('snippets.noSnippets')}</div>
        )}
      </div>

      <style>{`
        .snippet-manager { display: flex; flex-direction: column; gap: 8px; }
        .snippet-form {
          display: flex; flex-direction: column; gap: 8px;
          padding: 10px; background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .snippet-form input, .snippet-form textarea { width: 100%; }
        .snippet-list { display: flex; flex-direction: column; gap: 8px; }
        .snippet-item {
          padding: 10px; border-radius: var(--radius);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 6px;
        }
        .snippet-item:hover { background: var(--bg-surface-hover); }
        .snippet-label { font-size: 13px; font-weight: 600; }
        .snippet-command {
          font-size: 11px; color: var(--accent);
          font-family: 'JetBrains Mono', monospace;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          background: var(--bg-primary); padding: 6px 8px;
          border-radius: var(--radius-sm);
        }
        .snippet-desc { font-size: 11px; color: var(--text-secondary); }
        .snippet-actions { display: flex; gap: 6px; }
        .snippet-btn {
          padding: 4px 10px; font-size: 11px;
          background: transparent; color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
        }
        .snippet-btn:hover { background: var(--border); }
        .snippet-btn-run {
          background: var(--accent); color: #0d1b28;
          border-color: transparent; font-weight: 600;
        }
        .snippet-btn-run:hover { background: var(--accent-hover); }
        .snippet-btn-del:hover { background: var(--danger-bg); color: var(--danger); border-color: transparent; }
        .snippet-empty {
          color: var(--text-secondary); font-size: 13px;
          text-align: center; padding: 20px;
        }
      `}</style>
    </div>
  );
}
