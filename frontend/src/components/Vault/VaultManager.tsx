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
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    setShowPassword(false);
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

  const allCategories = ['all', 'general', 'social', 'finance', 'work', 'dev'];

  const catLabel = (cat: string) => {
    const map: Record<string, string> = {
      all: t('vault.all'),
      general: t('vault.catGeneral'),
      social: t('vault.catSocial'),
      finance: t('vault.catFinance'),
      work: t('vault.catWork'),
      dev: t('vault.catDev'),
    };
    return map[cat] || cat;
  };

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
            <div className="vault-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" />
              </svg>
              <input
                placeholder={t('vault.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="vault-search"
                autoComplete="off"
              />
            </div>
            <button className="vault-add-btn" onClick={openAdd}>+</button>
          </div>

          <div className="vault-categories">
            {allCategories.map((cat) => (
              <button
                key={cat}
                className={`vault-cat ${cat === category ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {catLabel(cat)}
              </button>
            ))}
          </div>

          <button
            className="vault-gen-toggle"
            onClick={() => setView('generator')}
          >
            {t('vault.generatePassword')} →
          </button>

          <div className="vault-items">
            {filtered.map((entry) => (
              <div key={entry.id} className="vault-item" onClick={() => openEdit(entry)}>
                <div className="vault-item-header">
                  <div className="vault-item-info">
                    <span className="vault-item-title">{entry.title}</span>
                    <span className="vault-item-user">{entry.username}</span>
                    {entry.url && <span className="vault-item-url">{entry.url}</span>}
                  </div>
                  <span className="vault-item-cat">{entry.category}</span>
                </div>
                {revealedId === entry.id && (
                  <div className="vault-revealed">
                    <code>{entry.password_enc}</code>
                  </div>
                )}
                <div className="vault-item-actions" onClick={(e) => e.stopPropagation()}>
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
                  <button
                    className="vault-act-btn vault-act-del"
                    onClick={() => handleDelete(entry.id)}
                  >
                    Del
                  </button>
                </div>
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
          <div className="vault-form-title">
            {view === 'edit' ? t('vault.edit') : t('vault.add')}
          </div>
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
          <div className="vault-pass-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('vault.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
            <button type="button" className="vault-eye" onClick={() => setShowPassword(!showPassword)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
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
            rows={4}
            autoComplete="off"
            style={{ resize: 'none' }}
          />
          <div className="vault-form-actions">
            <button className="primary" onClick={handleSave} style={{ flex: 1, height: 32, fontSize: 12 }}>
              {t('common.save')}
            </button>
            <button onClick={() => { resetForm(); setView('list'); }} style={{ flex: 1, height: 32, fontSize: 12, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {view === 'generator' && (
        <div>
          <button
            className="vault-back-btn"
            onClick={() => setView('list')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H6" /><path d="M11 6l-6 6 6 6" />
            </svg>
            {t('vault.back')}
          </button>
          <PasswordGenerator onUse={(pw) => {
            navigator.clipboard.writeText(pw);
          }} />
        </div>
      )}

      <style>{`
        .vault-manager { display: flex; flex-direction: column; gap: 10px; }
        .vault-toolbar { display: flex; gap: 8px; }
        .vault-search-wrap {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 0 10px;
        }
        .vault-search {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          padding: 8px 0;
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
        }
        .vault-search:focus { border: none; }
        .vault-add-btn {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          background: var(--accent);
          color: #0d1b28;
          font-size: 17px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .vault-add-btn:hover { background: var(--accent-hover); }
        .vault-categories { display: flex; flex-wrap: wrap; gap: 5px; }
        .vault-cat {
          font-size: 11px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          text-transform: capitalize;
          border: none;
        }
        .vault-cat.active { background: var(--accent); color: #0d1b28; }
        .vault-cat:hover { background: var(--bg-surface-hover); }
        .vault-cat.active:hover { background: var(--accent-hover); }
        .vault-gen-toggle {
          font-size: 12px;
          color: var(--text-secondary);
          background: none;
          padding: 2px 0;
          text-align: left;
          border: none;
        }
        .vault-gen-toggle:hover { color: var(--accent); }
        .vault-items { display: flex; flex-direction: column; gap: 8px; }
        .vault-item {
          padding: 10px; border-radius: var(--radius);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 6px;
          cursor: pointer;
        }
        .vault-item:hover { background: var(--bg-surface-hover); }
        .vault-item-header {
          display: flex; align-items: center; gap: 8px;
        }
        .vault-item-info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
        .vault-item-title { font-size: 13px; font-weight: 600; }
        .vault-item-user { font-size: 12px; color: var(--text-secondary); }
        .vault-item-url { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vault-item-cat {
          font-size: 10px; color: var(--accent); background: var(--accent-bg);
          padding: 2px 8px; border-radius: 999px; white-space: nowrap;
          text-transform: capitalize;
        }
        .vault-item-actions {
          display: flex; gap: 5px;
        }
        .vault-act-btn {
          padding: 3px 8px; font-size: 11px;
          background: transparent; color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
        }
        .vault-act-btn:hover { background: var(--border); }
        .vault-act-del { color: var(--text-secondary); margin-left: auto; }
        .vault-act-del:hover { background: var(--danger-bg); color: var(--danger); border-color: transparent; }
        .vault-revealed {
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-primary);
          background: var(--bg-primary);
          border-radius: var(--radius-sm);
          padding: 6px 8px;
          word-break: break-all;
        }
        .vault-empty {
          color: var(--text-secondary); font-size: 13px;
          text-align: center; padding: 20px;
        }
        .vault-form { display: flex; flex-direction: column; gap: 8px; }
        .vault-form-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
        .vault-form input, .vault-form textarea, .vault-form select { width: 100%; }
        .vault-form select {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          color: var(--text-primary);
          font-size: 14px;
        }
        .vault-pass-wrap {
          display: flex;
          align-items: center;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 0 10px 0 0;
        }
        .vault-pass-wrap input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
        }
        .vault-pass-wrap:focus-within {
          border-color: var(--accent);
        }
        .vault-eye {
          background: none;
          color: var(--text-secondary);
          padding: 0;
          display: flex;
          cursor: pointer;
          border: none;
        }
        .vault-eye:hover { color: var(--text-primary); }
        .vault-form-actions { display: flex; gap: 8px; margin-top: 2px; }
        .vault-back-btn {
          background: none; color: var(--text-secondary); font-size: 12px;
          padding: 4px 0; margin-bottom: 8px;
          display: flex; align-items: center; gap: 6px;
          border: none; cursor: pointer;
        }
        .vault-back-btn:hover { color: var(--text-primary); }
      `}</style>
    </div>
  );
}
