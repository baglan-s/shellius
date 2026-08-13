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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
      setDeleteConfirmId(null);
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
        style={{ width: '100%', marginBottom: 12 }}
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
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            autoComplete="off"
          />
          <input
            placeholder={t('snippets.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
          />
          <button className="primary" onClick={handleCreate} style={{ width: '100%' }}>
            {t('common.save')}
          </button>
        </div>
      )}

      <div className="snippet-list">
        {snippets.map((snippet) => (
          <div key={snippet.id} className="snippet-item">
            <div className="snippet-info">
              <span className="snippet-label">{snippet.label}</span>
              <code className="snippet-command">{snippet.command}</code>
              {snippet.description && (
                <span className="snippet-desc">{snippet.description}</span>
              )}
            </div>
            <div className="snippet-actions">
              {deleteConfirmId === snippet.id ? (
                <>
                  <button
                    className="snippet-btn snippet-btn-del"
                    onClick={() => handleDelete(snippet.id)}
                  >
                    {t('common.delete')}
                  </button>
                  <button
                    className="snippet-btn"
                    onClick={() => setDeleteConfirmId(null)}
                  >
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <>
                  {activeSessionId && (
                    <button
                      className="snippet-btn snippet-btn-run"
                      onClick={() => handleRun(snippet)}
                      title={t('snippets.run')}
                    >
                      {t('snippets.run')}
                    </button>
                  )}
                  <button
                    className="snippet-btn"
                    onClick={() => handleCopy(snippet.command)}
                    title={t('snippets.copy')}
                  >
                    {t('keys.copy')}
                  </button>
                  <button
                    className="snippet-btn snippet-btn-del"
                    onClick={() => setDeleteConfirmId(snippet.id)}
                    title={t('common.delete')}
                  >
                    {t('keys.delete')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {snippets.length === 0 && !showForm && (
          <div className="snippet-empty">{t('snippets.noSnippets')}</div>
        )}
      </div>

      <style>{`
        .snippet-manager { display: flex; flex-direction: column; gap: 12px; }
        .snippet-form {
          display: flex; flex-direction: column; gap: 8px;
          padding: 12px; background: var(--bg-surface);
          border-radius: var(--radius);
        }
        .snippet-form input, .snippet-form textarea { width: 100%; }
        .snippet-list { display: flex; flex-direction: column; gap: 6px; }
        .snippet-item {
          padding: 10px 12px; border-radius: var(--radius);
          background: var(--bg-surface);
          display: flex; justify-content: space-between;
          align-items: flex-start; gap: 8px;
        }
        .snippet-info { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
        .snippet-label { font-size: 13px; font-weight: 500; }
        .snippet-command {
          font-size: 11px; color: var(--accent);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          background: var(--bg-primary); padding: 3px 6px;
          border-radius: 3px;
        }
        .snippet-desc { font-size: 11px; color: var(--text-secondary); }
        .snippet-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .snippet-btn {
          padding: 3px 8px; font-size: 11px;
          background: var(--bg-secondary); color: var(--text-secondary);
          border-radius: 4px;
        }
        .snippet-btn:hover { color: var(--text-primary); }
        .snippet-btn-run { background: var(--accent); color: var(--bg-primary); }
        .snippet-btn-run:hover { background: var(--accent-hover); }
        .snippet-btn-del:hover { background: var(--danger); color: white; }
        .snippet-empty {
          color: var(--text-secondary); font-size: 13px;
          text-align: center; padding: 20px;
        }
      `}</style>
    </div>
  );
}
