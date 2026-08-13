import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useWS } from '../../contexts/WebSocketContext';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  sessionId: string;
}

export default function TerminalView({ sessionId }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { send, subscribe } = useWS();

  // Send typed data to backend
  const handleData = useCallback(
    (data: string) => {
      send({
        type: 'ssh.data',
        session_id: sessionId,
        payload: { data },
      });
    },
    [send, sessionId]
  );

  // Send resize events
  const handleResize = useCallback(
    (rows: number, cols: number) => {
      send({
        type: 'ssh.resize',
        session_id: sessionId,
        payload: { rows, cols },
      });
    },
    [send, sessionId]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b7066',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();

    term.onData(handleData);
    term.onResize(({ rows, cols }) => handleResize(rows, cols));

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    termRef.current = term;
    fitRef.current = fitAddon;

    // Subscribe to SSH data from backend
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'ssh.data' && msg.session_id === sessionId) {
        const payload = msg.payload as { data: string };
        if (payload?.data) {
          term.write(payload.data);
        }
      }
      if (msg.type === 'ssh.disconnect' && msg.session_id === sessionId) {
        term.write('\r\n\x1b[31m--- Session disconnected ---\x1b[0m\r\n');
      }
      if (msg.type === 'error' && msg.id === sessionId) {
        const payload = msg.payload as { message: string };
        term.write(`\r\n\x1b[31mError: ${payload?.message}\x1b[0m\r\n`);
      }
    });

    // Send initial resize
    setTimeout(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        handleResize(dims.rows, dims.cols);
      }
    }, 100);

    return () => {
      unsubscribe();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [sessionId, handleData, handleResize, subscribe]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#1e1e2e',
      }}
    />
  );
}
