import { useState } from 'react';

interface FileEntry {
  name: string;
  size: number;
  mode: string;
  modTime: number;
  isDir: boolean;
}

interface FileManagerProps {
  sessionId: string;
  onNavigate: (path: string) => void;
  files: FileEntry[];
}

export default function FileManager({ files, onNavigate }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('/');

  const navigate = (name: string, isDir: boolean) => {
    if (!isDir) return;
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    setCurrentPath(newPath);
    onNavigate(newPath);
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
    onNavigate(parent);
  };

  return (
    <div className="file-manager">
      <div className="fm-toolbar">
        <button onClick={goUp} disabled={currentPath === '/'}>
          ..
        </button>
        <span className="fm-path">{currentPath}</span>
      </div>

      <div className="fm-list">
        {files.map((file) => (
          <div
            key={file.name}
            className="fm-item"
            onDoubleClick={() => navigate(file.name, file.isDir)}
          >
            <span className="fm-icon">{file.isDir ? '📁' : '📄'}</span>
            <span className="fm-name">{file.name}</span>
            <span className="fm-size">{file.isDir ? '' : formatSize(file.size)}</span>
            <span className="fm-mode">{file.mode}</span>
          </div>
        ))}
      </div>

      <style>{`
        .file-manager { display: flex; flex-direction: column; height: 100%; }
        .fm-toolbar {
          display: flex; align-items: center; gap: 8px;
          padding: 8px; border-bottom: 1px solid var(--border);
        }
        .fm-path { font-size: 13px; color: var(--text-secondary); }
        .fm-list { flex: 1; overflow-y: auto; }
        .fm-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 12px; cursor: pointer; font-size: 13px;
        }
        .fm-item:hover { background: var(--bg-surface); }
        .fm-name { flex: 1; }
        .fm-size { color: var(--text-secondary); font-size: 12px; width: 80px; text-align: right; }
        .fm-mode { color: var(--text-secondary); font-size: 12px; font-family: monospace; }
      `}</style>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
