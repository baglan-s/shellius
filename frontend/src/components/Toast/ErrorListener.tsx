import { useEffect } from 'react';
import { useWS } from '../../contexts/WebSocketContext';
import { useToastStore } from '../../stores/toastStore';

export function ErrorListener() {
  const { subscribe } = useWS();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'error') {
        const payload = msg.payload as { message?: string } | undefined;
        const message = payload?.message || 'Unknown error';
        addToast(message, 'error');
      }
    });
  }, [subscribe, addToast]);

  return null;
}
