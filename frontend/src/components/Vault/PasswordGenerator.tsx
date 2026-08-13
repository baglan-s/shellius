import { useState, useCallback } from 'react';

interface PasswordGeneratorProps {
  onUse: (password: string) => void;
}

export default function PasswordGenerator({ onUse }: PasswordGeneratorProps) {
  const [length, setLength] = useState(20);
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

  return (
    <div className="pw-gen">
      <div className="pw-gen-output">
        <code>{generated || 'Click Generate'}</code>
      </div>

      <div className="pw-gen-controls">
        <label>
          Length: {length}
          <input type="range" min={8} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} />
        </label>
        <label><input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} /> Uppercase</label>
        <label><input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} /> Numbers</label>
        <label><input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} /> Symbols</label>
      </div>

      <div className="pw-gen-actions">
        <button className="primary" onClick={generate}>Generate</button>
        {generated && <button onClick={() => onUse(generated)}>Use</button>}
      </div>

      <style>{`
        .pw-gen { display: flex; flex-direction: column; gap: 12px; }
        .pw-gen-output {
          padding: 12px; background: var(--bg-surface); border-radius: var(--radius);
          word-break: break-all; font-size: 14px;
        }
        .pw-gen-controls { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
        .pw-gen-controls label { display: flex; align-items: center; gap: 8px; }
        .pw-gen-controls input[type="range"] { flex: 1; }
        .pw-gen-actions { display: flex; gap: 8px; }
      `}</style>
    </div>
  );
}
