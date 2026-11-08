import { useState, useEffect, useCallback } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useI18n } from '../../i18n';

interface FileInfo {
  name: string;
  size: number;
  mode: string;
  mod_time: number;
  is_dir: boolean;
}

interface FileManagerProps {
  sessionId: string;
  onClose: () => void;
}

export default function FileManager({ sessionId, onClose }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMkdir, setShowMkdir] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);
  const { send, subscribe } = useWS();
  const { t } = useI18n();

  const loadDir = useCallback(
    (path: string) => {
      setLoading(true);
      send({
        type: 'sftp.list',
        id: `sftp-list-${Date.now()}`,
        session_id: sessionId,
        payload: { path },
      });
    },
    [send, sessionId]
  );

  useEffect(() => {
    loadDir(currentPath);
  }, [loadDir, currentPath]);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.session_id !== sessionId) return;

      if (msg.type === 'sftp.list') {
        const payload = msg.payload as { path: string; files: FileInfo[] };
        setFiles(sortFiles(payload.files || []));
        setCurrentPath(payload.path);
        setLoading(false);
      }
      if (msg.type === 'sftp.download') {
        const payload = msg.payload as { path: string; data: string };
        const bytes = atob(payload.data);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = payload.path.split('/').pop() || 'file';
        a.click();
        URL.revokeObjectURL(url);
      }
      if (msg.type === 'success' && msg.id?.startsWith('sftp-')) {
        loadDir(currentPath);
        setShowMkdir(false);
        setNewFolderName('');
        setDeleteConfirmName(null);
      }
    });
  }, [subscribe, sessionId, currentPath, loadDir]);

  const navigateTo = (name: string) => {
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath('/' + parts.join('/'));
  };

  const handleMkdir = () => {
    if (!newFolderName.trim()) return;
    const path = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
    send({
      type: 'sftp.mkdir',
      id: `sftp-mkdir-${Date.now()}`,
      session_id: sessionId,
      payload: { path },
    });
  };

  const handleDelete = (name: string) => {
    const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    send({
      type: 'sftp.remove',
      id: `sftp-remove-${Date.now()}`,
      session_id: sessionId,
      payload: { path },
    });
  };

  const handleDownload = (name: string) => {
    const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    send({
      type: 'sftp.download',
      id: `sftp-download-${Date.now()}`,
      session_id: sessionId,
      payload: { path },
    });
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = btoa(
          new Uint8Array(reader.result as ArrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        const path = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
        send({
          type: 'sftp.upload',
          id: `sftp-upload-${Date.now()}`,
          session_id: sessionId,
          payload: { path, data: base64 },
        });
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  return (
    <div className="file-manager">
      <div className="fm-header">
        <div className="fm-title">{t('sftp.title')}</div>
        <button className="fm-close" onClick={onClose}>✕</button>
      </div>

      <div className="fm-toolbar">
        <div className="fm-toolbar-top">
          <button className="fm-nav-btn" onClick={navigateUp} disabled={currentPath === '/'} title={t('sftp.parentDir')}>
            ..
          </button>
          <div className="fm-path">{currentPath}</div>
        </div>
        <div className="fm-toolbar-actions">
          <button className="fm-tool-btn" onClick={() => setShowMkdir(!showMkdir)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <path d="M12 11v4M10 13h4" />
            </svg>
            {t('sftp.newFolder')}
          </button>
          <button className="fm-tool-btn" onClick={handleUpload}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 16V4" /><path d="M7 9l5-5 5 5" />
              <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
            </svg>
            {t('sftp.upload')}
          </button>
        </div>
      </div>

      {showMkdir && (
        <div className="fm-mkdir">
          <input
            placeholder={t('sftp.folderName')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMkdir()}
            autoFocus
            autoComplete="off"
            style={{ fontSize: 12, padding: '6px 9px' }}
          />
          <button className="fm-mkdir-save" onClick={handleMkdir}>{t('common.save')}</button>
        </div>
      )}

      <div className="fm-list">
        {loading && <div className="fm-loading">...</div>}
        {!loading && files.map((file) => (
          <div key={file.name} className="fm-item">
            <div
              className="fm-item-info"
              onClick={() => file.is_dir && navigateTo(file.name)}
              style={{ cursor: file.is_dir ? 'pointer' : 'default' }}
            >
              <div className="fm-icon" style={{ color: file.is_dir ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {file.is_dir ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" />
                  </svg>
                )}
              </div>
              <div className="fm-item-details">
                <div className={`fm-name ${file.is_dir ? 'fm-name-dir' : ''}`}>{file.name}</div>
                <div className="fm-meta">
                  {file.is_dir ? file.mode : `${formatSize(file.size)} · ${file.mode}`}
                </div>
              </div>
            </div>
            <div className="fm-item-actions">
              {deleteConfirmName === file.name ? (
                <>
                  <button className="fm-act-btn fm-act-del-confirm" onClick={() => handleDelete(file.name)}>
                    {t('common.delete')}
                  </button>
                  <button className="fm-act-btn" onClick={() => setDeleteConfirmName(null)}>
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <>
                  {!file.is_dir && (
                    <button className="fm-act-btn fm-act-download" onClick={() => handleDownload(file.name)} title="Download">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" />
                      </svg>
                    </button>
                  )}
                  <button className="fm-act-btn fm-act-del" onClick={() => setDeleteConfirmName(file.name)} title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M3 6h18" /><path d="M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {!loading && files.length === 0 && (
          <div className="fm-empty">Empty directory</div>
        )}
      </div>

      <style>{`
        .file-manager {
          width: 340px;
          flex: 0 0 340px;
          background: var(--bg-secondary);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .fm-header {
          height: 44px;
          flex: 0 0 44px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          border-bottom: 1px solid var(--border);
        }
        .fm-title { flex: 1; font-size: 14px; font-weight: 600; }
        .fm-close {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          font-size: 12px;
          background: none;
          padding: 0;
          border: none;
          cursor: pointer;
        }
        .fm-close:hover { background: var(--bg-surface); color: var(--text-primary); }
        .fm-toolbar {
          flex: 0 0 auto;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .fm-toolbar-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fm-nav-btn {
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 3px 8px;
          background: none;
          cursor: pointer;
        }
        .fm-nav-btn:hover { background: var(--bg-surface); }
        .fm-nav-btn:disabled { opacity: 0.4; cursor: default; }
        .fm-path {
          flex: 1;
          min-width: 0;
          font-size: 12px;
          color: var(--text-secondary);
          font-family: 'JetBrains Mono', monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          direction: rtl;
          text-align: left;
        }
        .fm-toolbar-actions {
          display: flex;
          gap: 6px;
        }
        .fm-tool-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--text-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 4px 8px;
          background: none;
          cursor: pointer;
        }
        .fm-tool-btn:hover { background: var(--bg-surface); }
        .fm-mkdir {
          display: flex;
          gap: 6px;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
        }
        .fm-mkdir input { flex: 1; min-width: 0; }
        .fm-mkdir-save {
          font-size: 11px;
          font-weight: 600;
          color: #0d1b28;
          background: var(--accent);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          border: none;
          cursor: pointer;
        }
        .fm-list {
          flex: 1;
          overflow: auto;
          padding: 6px;
        }
        .fm-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 8px;
          border-radius: var(--radius-md);
        }
        .fm-item:hover { background: var(--bg-surface); }
        .fm-item:hover .fm-item-actions { opacity: 1; }
        .fm-item-info {
          display: flex;
          align-items: center;
          gap: 9px;
          flex: 1;
          min-width: 0;
        }
        .fm-icon { display: flex; flex-shrink: 0; }
        .fm-item-details { min-width: 0; flex: 1; }
        .fm-name {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fm-name-dir { color: var(--accent); }
        .fm-meta {
          font-size: 10px;
          color: var(--text-secondary);
          font-family: 'JetBrains Mono', monospace;
        }
        .fm-item-actions {
          opacity: 0;
          display: flex;
          gap: 4px;
          flex-shrink: 0;
          transition: opacity 150ms ease;
        }
        .fm-act-btn {
          width: 22px;
          height: 22px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          background: none;
          padding: 0;
          border: none;
          cursor: pointer;
        }
        .fm-act-download:hover { background: var(--border); color: var(--accent); }
        .fm-act-del:hover { background: var(--danger-bg); color: var(--danger); }
        .fm-act-del-confirm {
          width: auto;
          padding: 2px 8px;
          font-size: 10px;
          background: var(--danger);
          color: #fff;
        }
        .fm-loading, .fm-empty {
          text-align: center;
          padding: 20px;
          color: var(--text-secondary);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function sortFiles(files: FileInfo[]): FileInfo[] {
  return [...files].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
