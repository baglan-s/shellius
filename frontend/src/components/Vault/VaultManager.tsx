import { useState, useEffect, useCallback } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useVaultStore, VaultEntry } from '../../stores/vaultStore';
import { useI18n } from '../../i18n';
import PasswordGenerator from './PasswordGenerator';

export default function VaultManager() {
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'generator'>('list');
  const [editEntry, setEditEntry] = useState<VaultEntry | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [formCategory, setFormCategory] = useState('general');

  const { send, subscribe } = useWS();
  const entries = useVaultStore((s) => s.entries);
  const setEntries = useVaultStore((s) => s.setEntries);
  const addEntry = useVaultStore((s) => s.addEntry);
  const updateEntry = useVaultStore((s) => s.updateEntry);
  const removeEntry = useVaultStore((s) => s.removeEntry);
  const { t } = useI18n();

  useEffect(() => {
    send({ type: 'vault.list' });
  }, [send]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'vault.list' && Array.isArray(msg.payload)) {
        setEntries(msg.payload);
      }
      if (msg.type === 'success' && msg.id?.startsWith('create-vault-')) {
        addEntry(msg.payload as VaultEntry);
        resetForm();
        setView('list');
      }
      if (msg.type === 'success' && msg.id?.startsWith('update-vault-')) {
        updateEntry(msg.payload as VaultEntry);
        resetForm();
        setView('list');
      }
      if (msg.type === 'success' && msg.id?.startsWith('del-vault-')) {
        const id = msg.id.replace('del-vault-', '');
        removeEntry(id);
        setDeleteConfirmId(null);
      }
    });
  }, [subscribe, setEntries, addEntry, updateEntry, removeEntry]);

  const resetForm = () => {
    setTitle('');
    setUsername('');
    setPassword('');
    setUrl('');
    setNotes('');
    setFormCategory('general');
    setEditEntry(null);
  };

  const openAdd = () => {
    resetForm();
    setView('add');
  };

  const openEdit = (entry: VaultEntry) => {
    setEditEntry(entry);
    setTitle(entry.title);
    setUsername(entry.username);
    setPassword(entry.password_enc);
    setUrl(entry.url);
    setNotes(entry.notes_enc);
    setFormCategory(entry.category || 'general');
    setView('edit');
  };

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    if (editEntry) {
      send({
        type: 'vault.update',
        id: `update-vault-${Date.now()}`,
        payload: {
          id: editEntry.id,
          title,
          username,
          password_enc: password,
          url,
          notes_enc: notes,
          category: formCategory,
        },
      });
    } else {
      send({
        type: 'vault.create',
        id: `create-vault-${Date.now()}`,
        payload: {
          title,
          username,
          password_enc: password,
          url,
          notes_enc: notes,
          category: formCategory,
        },
      });
    }
  }, [send, editEntry, title, username, password, url, notes, formCategory]);

  const handleDelete = useCallback(
    (id: string) => {
      send({
        type: 'vault.delete',
        id: `del-vault-${id}`,
        payload: { id },
      });
    },
    [send]
  );

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const categories = ['all', ...new Set(entries.map((e) => e.category).filter(Boolean))];

  const filtered = entries.filter((e) => {
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase()) ||
      e.url.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'all' || e.category === category;
    return matchSearch && matchCategory;
  });

  return (
    <div className="vault-manager">
      {view === 'list' && (
        <>
          <div className="vault-toolbar">
            <input
              placeholder={t('vault.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="vault-search"
              autoComplete="off"
            />
            <button className="primary vault-add-btn" onClick={openAdd}>+</button>
          </div>

          {categories.length > 1 && (
            <div className="vault-categories">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`vault-cat ${cat === category ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat === 'all' ? t('vault.all') : cat}
                </button>
              ))}
            </div>
          )}

          <button
            className="vault-gen-toggle"
            onClick={() => setView('generator')}
          >
            {t('vault.generatePassword')}
          </button>

          <div className="vault-items">
            {filtered.map((entry) => (
              <div key={entry.id} className="vault-item">
                <div className="vault-item-header" onClick={() => openEdit(entry)}>
                  <div className="vault-item-info">
                    <span className="vault-item-title">{entry.title}</span>
                    <span className="vault-item-user">{entry.username}</span>
                    {entry.url && <span className="vault-item-url">{entry.url}</span>}
                  </div>
                  <span className="vault-item-cat">{entry.category}</span>
                </div>
                <div className="vault-item-actions">
                  <button
                    className="vault-act-btn"
                    onClick={() => copyToClipboard(entry.username, `user-${entry.id}`)}
                  >
                    {copiedField === `user-${entry.id}` ? t('vault.copied') : t('vault.copyUser')}
                  </button>
                  <button
                    className="vault-act-btn"
                    onClick={() => copyToClipboard(entry.password_enc, `pass-${entry.id}`)}
                  >
                    {copiedField === `pass-${entry.id}` ? t('vault.copied') : t('vault.copyPass')}
                  </button>
                  <button
                    className="vault-act-btn"
                    onClick={() => setRevealedId(revealedId === entry.id ? null : entry.id)}
                  >
                    {revealedId === entry.id ? t('vault.hide') : t('vault.reveal')}
                  </button>
                  {deleteConfirmId === entry.id ? (
                    <>
                      <button className="vault-act-btn vault-act-del" onClick={() => handleDelete(entry.id)}>
                        {t('common.delete')}
                      </button>
                      <button className="vault-act-btn" onClick={() => setDeleteConfirmId(null)}>
                        {t('common.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="vault-act-btn vault-act-del"
                      onClick={() => setDeleteConfirmId(entry.id)}
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </div>
                {revealedId === entry.id && (
                  <div className="vault-revealed">
                    <code>{entry.password_enc}</code>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="vault-empty">{t('vault.noEntries')}</div>
            )}
          </div>
        </>
      )}

      {(view === 'add' || view === 'edit') && (
        <div className="vault-form">
          <h3 className="vault-form-title">
            {view === 'edit' ? t('vault.edit') : t('vault.add')}
          </h3>
          <input
            placeholder={t('vault.title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
          <input
            placeholder={t('vault.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
          <input
            type="password"
            placeholder={t('vault.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            placeholder={t('vault.url')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="off"
          />
          <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
            <option value="general">{t('vault.catGeneral')}</option>
            <option value="social">{t('vault.catSocial')}</option>
            <option value="finance">{t('vault.catFinance')}</option>
            <option value="work">{t('vault.catWork')}</option>
            <option value="dev">{t('vault.catDev')}</option>
          </select>
          <textarea
            placeholder={t('vault.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            autoComplete="off"
          />
          <div className="vault-form-actions">
            <button className="primary" onClick={handleSave}>{t('common.save')}</button>
            <button onClick={() => { resetForm(); setView('list'); }}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {view === 'generator' && (
        <div>
          <button
            className="vault-back-btn"
            onClick={() => setView('list')}
          >
            &larr; {t('vault.back')}
          </button>
          <PasswordGenerator onUse={(pw) => {
            navigator.clipboard.writeText(pw);
          }} />
        </div>
      )}

      <style>{`
        .vault-manager { display: flex; flex-direction: column; gap: 10px; }
        .vault-toolbar { display: flex; gap: 8px; }
        .vault-search { flex: 1; }
        .vault-add-btn { width: 36px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; }
        .vault-categories { display: flex; gap: 4px; flex-wrap: wrap; }
        .vault-cat {
          padding: 4px 10px; font-size: 11px; background: var(--bg-surface);
          color: var(--text-secondary); border-radius: 12px; text-transform: capitalize;
        }
        .vault-cat.active { background: var(--accent); color: var(--bg-primary); }
        .vault-gen-toggle {
          padding: 6px 12px; font-size: 11px; background: var(--bg-surface);
          color: var(--text-secondary); border-radius: var(--radius); text-align: left;
        }
        .vault-gen-toggle:hover { color: var(--text-primary); }
        .vault-items { display: flex; flex-direction: column; gap: 6px; }
        .vault-item {
          padding: 10px 12px; border-radius: var(--radius);
          background: var(--bg-surface);
        }
        .vault-item-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          cursor: pointer; gap: 8px;
        }
        .vault-item-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .vault-item-title { font-size: 13px; font-weight: 500; }
        .vault-item-user { font-size: 12px; color: var(--text-secondary); }
        .vault-item-url { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vault-item-cat {
          font-size: 10px; color: var(--accent); background: var(--bg-primary);
          padding: 2px 8px; border-radius: 8px; flex-shrink: 0; text-transform: capitalize;
        }
        .vault-item-actions {
          display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap;
        }
        .vault-act-btn {
          padding: 3px 8px; font-size: 10px;
          background: var(--bg-secondary); color: var(--text-secondary);
          border-radius: 4px;
        }
        .vault-act-btn:hover { color: var(--text-primary); }
        .vault-act-del:hover { background: var(--danger); color: white; }
        .vault-revealed {
          margin-top: 8px; padding: 6px 10px; background: var(--bg-primary);
          border-radius: 4px; font-size: 12px; word-break: break-all;
        }
        .vault-empty {
          color: var(--text-secondary); font-size: 13px;
          text-align: center; padding: 20px;
        }
        .vault-form { display: flex; flex-direction: column; gap: 10px; }
        .vault-form-title { font-size: 14px; font-weight: 600; }
        .vault-form input, .vault-form textarea, .vault-form select { width: 100%; }
        .vault-form select {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 8px 12px;
          color: var(--text-primary); font-size: 14px;
        }
        .vault-form-actions { display: flex; gap: 8px; }
        .vault-back-btn {
          background: none; color: var(--text-secondary); font-size: 12px;
          padding: 4px 0; margin-bottom: 8px;
        }
        .vault-back-btn:hover { color: var(--text-primary); }
      `}</style>
    </div>
  );
}
