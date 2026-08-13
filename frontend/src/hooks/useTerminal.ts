import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface UseTerminalOptions {
  onData: (data: string) => void;
  onResize: (rows: number, cols: number) => void;
}

export function useTerminal({ onData, onResize }: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b7066',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();

    term.onData(onData);
    term.onResize(({ rows, cols }) => onResize(rows, cols));

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [onData, onResize]);

  const write = (data: string | Uint8Array) => {
    termRef.current?.write(data);
  };

  return { containerRef, write };
}
