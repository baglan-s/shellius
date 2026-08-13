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
        <button className="fm-close" onClick={onClose}>&times;</button>
      </div>

      <div className="fm-toolbar">
        <button className="fm-tool-btn" onClick={navigateUp} disabled={currentPath === '/'} title={t('sftp.parentDir')}>
          ..
        </button>
        <div className="fm-path">{currentPath}</div>
        <button className="fm-tool-btn" onClick={() => setShowMkdir(!showMkdir)}>
          {t('sftp.newFolder')}
        </button>
        <button className="fm-tool-btn" onClick={handleUpload}>
          {t('sftp.upload')}
        </button>
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
          />
          <button className="fm-tool-btn" onClick={handleMkdir}>{t('common.save')}</button>
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
              <span className="fm-icon">{file.is_dir ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>
              <span className={`fm-name ${file.is_dir ? 'fm-name-dir' : ''}`}>{file.name}</span>
              {!file.is_dir && <span className="fm-size">{formatSize(file.size)}</span>}
              <span className="fm-mode">{file.mode}</span>
            </div>
            <div className="fm-item-actions">
              {deleteConfirmName === file.name ? (
                <>
                  <button className="fm-act-btn fm-act-del" onClick={() => handleDelete(file.name)}>
                    {t('common.delete')}
                  </button>
                  <button className="fm-act-btn" onClick={() => setDeleteConfirmName(null)}>
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <>
                  {!file.is_dir && (
                    <button className="fm-act-btn" onClick={() => handleDownload(file.name)}>
                      {t('sftp.download')}
                    </button>
                  )}
                  <button
                    className="fm-act-btn fm-act-del"
                    onClick={() => setDeleteConfirmName(file.name)}
                  >
                    {t('sftp.delete')}
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
          background: var(--bg-secondary);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .fm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .fm-title { font-size: 14px; font-weight: 600; }
        .fm-close {
          background: none;
          color: var(--text-secondary);
          font-size: 18px;
          padding: 2px 6px;
        }
        .fm-close:hover { color: var(--text-primary); }
        .fm-toolbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .fm-path {
          flex: 1;
          font-size: 12px;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 60px;
        }
        .fm-tool-btn {
          padding: 4px 8px;
          font-size: 11px;
          background: var(--bg-surface);
          color: var(--text-primary);
          border-radius: 4px;
          white-space: nowrap;
        }
        .fm-tool-btn:hover { background: var(--border); }
        .fm-tool-btn:disabled { opacity: 0.4; cursor: default; }
        .fm-mkdir {
          display: flex;
          gap: 6px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
        }
        .fm-mkdir input {
          flex: 1;
          padding: 4px 8px;
          font-size: 12px;
        }
        .fm-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .fm-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          gap: 8px;
        }
        .fm-item:hover { background: var(--bg-surface); }
        .fm-item:hover .fm-item-actions { opacity: 1; }
        .fm-item-info {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        .fm-icon { font-size: 14px; flex-shrink: 0; }
        .fm-name {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fm-name-dir { color: var(--accent); }
        .fm-size {
          font-size: 11px;
          color: var(--text-secondary);
          flex-shrink: 0;
          margin-left: auto;
        }
        .fm-mode {
          font-size: 10px;
          color: var(--text-secondary);
          flex-shrink: 0;
          font-family: monospace;
        }
        .fm-item-actions {
          opacity: 0;
          display: flex;
          gap: 4px;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .fm-act-btn {
          padding: 2px 6px;
          font-size: 10px;
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border-radius: 3px;
        }
        .fm-act-btn:hover { color: var(--text-primary); }
        .fm-act-del:hover { background: var(--danger); color: white; }
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
