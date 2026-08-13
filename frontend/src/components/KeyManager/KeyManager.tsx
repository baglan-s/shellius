import { useState, useEffect, useCallback } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useKeyStore, SSHKey } from '../../stores/keyStore';

export default function KeyManager() {
  const [showForm, setShowForm] = useState<'generate' | 'import' | null>(null);
  const [label, setLabel] = useState('');
  const [importKey, setImportKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const { send, subscribe } = useWS();
  const keys = useKeyStore((s) => s.keys);
  const setKeys = useKeyStore((s) => s.setKeys);
  const addKey = useKeyStore((s) => s.addKey);
  const removeKey = useKeyStore((s) => s.removeKey);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    send({ type: 'key.list' });
  }, [send]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'key.list' && Array.isArray(msg.payload)) {
        setKeys(msg.payload);
      }
      if (msg.type === 'success' && msg.id?.startsWith('gen-key-')) {
        addKey(msg.payload as SSHKey);
        setShowForm(null);
        setLabel('');
      }
      if (msg.type === 'success' && msg.id?.startsWith('import-key-')) {
        addKey(msg.payload as SSHKey);
        setShowForm(null);
        setLabel('');
        setImportKey('');
        setPassphrase('');
      }
      if (msg.type === 'success' && msg.id?.startsWith('del-key-')) {
        const id = msg.id.replace('del-key-', '');
        removeKey(id);
      }
    });
  }, [subscribe, setKeys, addKey, removeKey]);

  const handleGenerate = useCallback(() => {
    if (!label.trim()) return;
    send({
      type: 'key.generate',
      id: `gen-key-${Date.now()}`,
      payload: { label },
    });
  }, [send, label]);

  const handleImport = useCallback(() => {
    if (!label.trim() || !importKey.trim()) return;
    send({
      type: 'key.import',
      id: `import-key-${Date.now()}`,
      payload: { label, private_key: importKey, passphrase },
    });
  }, [send, label, importKey, passphrase]);

  const handleDelete = useCallback(
    (id: string) => {
      send({
        type: 'key.delete',
        id: `del-key-${id}`,
        payload: { id },
      });
    },
    [send]
  );

  const copyPublicKey = (key: SSHKey) => {
    navigator.clipboard.writeText(key.public_key);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="key-manager">
      <div className="key-actions">
        <button
          className="primary"
          style={{ flex: 1 }}
          onClick={() => setShowForm(showForm === 'generate' ? null : 'generate')}
        >
          Generate
        </button>
        <button
          style={{ flex: 1, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          onClick={() => setShowForm(showForm === 'import' ? null : 'import')}
        >
          Import
        </button>
      </div>

      {showForm === 'generate' && (
        <div className="key-form">
          <input
            placeholder="Key label (e.g. My Server)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoComplete="off"
          />
          <div className="key-form-hint">Generates Ed25519 key pair</div>
          <button className="primary" onClick={handleGenerate} style={{ width: '100%' }}>
            Generate Key
          </button>
        </div>
      )}

      {showForm === 'import' && (
        <div className="key-form">
          <input
            placeholder="Key label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoComplete="off"
          />
          <textarea
            placeholder="Paste private key here (PEM format)"
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            rows={6}
            style={{ fontFamily: 'monospace', fontSize: 11 }}
            autoComplete="off"
          />
          <input
            type="password"
            placeholder="Passphrase (leave empty if none)"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="new-password"
          />
          <button className="primary" onClick={handleImport} style={{ width: '100%' }}>
            Import Key
          </button>
        </div>
      )}

      <div className="key-list">
        {keys.map((key) => (
          <div key={key.id} className="key-item">
            <div className="key-info">
              <span className="key-label">{key.label}</span>
              <code className="key-fingerprint">
                {key.public_key?.slice(0, 40)}...
              </code>
            </div>
            <div className="key-item-actions">
              <button
                className="key-btn"
                onClick={() => copyPublicKey(key)}
                title="Copy public key"
              >
                {copiedId === key.id ? 'Copied!' : 'Copy'}
              </button>
              <button
                className="key-btn key-btn-del"
                onClick={() => handleDelete(key.id)}
                title="Delete key"
              >
                Del
              </button>
            </div>
          </div>
        ))}
        {keys.length === 0 && (
          <div className="key-empty">
            No keys yet. Generate or import one.
          </div>
        )}
      </div>

      <style>{`
        .key-manager { display: flex; flex-direction: column; gap: 12px; }
        .key-actions { display: flex; gap: 8px; }
        .key-form {
          display: flex; flex-direction: column; gap: 8px;
          padding: 12px; background: var(--bg-surface);
          border-radius: var(--radius);
        }
        .key-form input, .key-form textarea { width: 100%; }
        .key-form-hint { font-size: 11px; color: var(--text-secondary); }
        .key-list { display: flex; flex-direction: column; gap: 6px; }
        .key-item {
          padding: 10px 12px; border-radius: var(--radius);
          background: var(--bg-surface);
          display: flex; justify-content: space-between;
          align-items: flex-start; gap: 8px;
        }
        .key-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .key-label { font-size: 13px; font-weight: 500; }
        .key-fingerprint {
          font-size: 10px; color: var(--text-secondary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .key-item-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .key-btn {
          padding: 3px 8px; font-size: 11px;
          background: var(--bg-secondary); color: var(--text-secondary);
          border-radius: 4px;
        }
        .key-btn:hover { color: var(--text-primary); }
        .key-btn-del:hover { background: var(--danger); color: white; }
        .key-empty {
          color: var(--text-secondary); font-size: 13px;
          text-align: center; padding: 20px;
        }
      `}</style>
    </div>
  );
}
