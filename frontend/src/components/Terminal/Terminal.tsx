import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useWS } from '../../contexts/WebSocketContext';
import { useThemeStore } from '../../stores/themeStore';
import '@xterm/xterm/css/xterm.css';

const DARK_THEME = {
  background: '#1a1b2e',
  foreground: '#e4e4e7',
  cursor: '#5BB8F5',
  selectionBackground: '#5BB8F533',
  black: '#2a2b3d',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#5BB8F5',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#18181b',
  cursor: '#2563eb',
  selectionBackground: '#2563eb33',
  black: '#18181b',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#d97706',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#f4f4f5',
};

interface TerminalViewProps {
  sessionId: string;
}

export default function TerminalView({ sessionId }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { send, subscribe } = useWS();
  const theme = useThemeStore((s) => s.theme);

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

    const termTheme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      theme: termTheme,
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

  // Update terminal theme when app theme changes
  useEffect(() => {
    if (termRef.current) {
      const termTheme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
      termRef.current.options.theme = termTheme;
    }
  }, [theme]);

  const bgColor = theme === 'light' ? LIGHT_THEME.background : DARK_THEME.background;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: bgColor,
        padding: '12px 14px',
      }}
    />
  );
}
