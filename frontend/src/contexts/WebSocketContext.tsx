import { createContext, useContext, ReactNode } from 'react';
import { useWebSocket, WSMessage } from '../hooks/useWebSocket';

interface WebSocketContextValue {
  send: (msg: WSMessage) => void;
  subscribe: (handler: (msg: WSMessage) => void) => () => void;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();
  return (
    <WebSocketContext.Provider value={ws}>{children}</WebSocketContext.Provider>
  );
}

export function useWS(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWS must be used within WebSocketProvider');
  return ctx;
}
