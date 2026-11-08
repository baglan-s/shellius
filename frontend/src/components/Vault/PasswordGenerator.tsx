import { useState, useCallback } from 'react';

interface PasswordGeneratorProps {
  onUse: (password: string) => void;
}

export default function PasswordGenerator({ onUse }: PasswordGeneratorProps) {
  const [length, setLength] = useState(24);
  const [uppercase, setUppercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [generated, setGenerated] = useState('');

  const generate = useCallback(() => {
    let chars = 'abcdefghijklmnopqrstuvwxyz';
    if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (numbers) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    const password = Array.from(array, (n) => chars[n % chars.length]).join('');

    setGenerated(password);
  }, [length, uppercase, numbers, symbols]);

  const options = [
    { label: 'Uppercase', checked: uppercase, toggle: () => setUppercase(!uppercase) },
    { label: 'Numbers', checked: numbers, toggle: () => setNumbers(!numbers) },
    { label: 'Symbols', checked: symbols, toggle: () => setSymbols(!symbols) },
  ];

  return (
    <div className="pw-gen">
      <div className="pw-gen-title">Password Generator</div>

      <div className="pw-gen-output">
        <code>{generated || 'Click Generate'}</code>
      </div>

      <div className="pw-gen-length">
        <div className="pw-gen-length-header">
          <span>Length</span>
          <span className="pw-gen-length-val">{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>

      <div className="pw-gen-options">
        {options.map((o) => (
          <div key={o.label} className="pw-gen-option" onClick={o.toggle}>
            <div
              className="pw-gen-checkbox"
              style={{
                borderColor: o.checked ? 'var(--accent)' : 'var(--border)',
                background: o.checked ? 'var(--accent)' : 'transparent',
              }}
            >
              {o.checked && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0d1b28" strokeWidth="3.2" strokeLinecap="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {o.label}
          </div>
        ))}
      </div>

      <div className="pw-gen-actions">
        <button className="primary" onClick={generate} style={{ flex: 1, height: 32, fontSize: 12 }}>
          Generate
        </button>
        {generated && (
          <button onClick={() => onUse(generated)} style={{ flex: 1, height: 32, fontSize: 12, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            Use
          </button>
        )}
      </div>

      <style>{`
        .pw-gen { display: flex; flex-direction: column; gap: 12px; }
        .pw-gen-title { font-size: 14px; font-weight: 600; }
        .pw-gen-output {
          padding: 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          word-break: break-all;
          font-family: 'JetBrains Mono', monospace;
          font-size: 15px;
          line-height: 1.5;
        }
        .pw-gen-length { display: flex; flex-direction: column; gap: 6px; }
        .pw-gen-length-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .pw-gen-length-val {
          color: var(--accent);
          font-family: 'JetBrains Mono', monospace;
        }
        .pw-gen-options { display: flex; flex-direction: column; gap: 8px; }
        .pw-gen-option {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          cursor: pointer;
          color: var(--text-primary);
        }
        .pw-gen-checkbox {
          width: 16px;
          height: 16px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pw-gen-actions { display: flex; gap: 8px; }
      `}</style>
    </div>
  );
}
