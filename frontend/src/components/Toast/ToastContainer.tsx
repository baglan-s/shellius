import { useToastStore } from '../../stores/toastStore';

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  const getToastStyle = (type: string) => {
    switch (type) {
      case 'error':
        return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', accent: '#ef4444' };
      case 'success':
        return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', accent: '#22c55e' };
      default:
        return { bg: 'rgba(91,184,245,0.12)', border: 'rgba(91,184,245,0.3)', accent: '#5BB8F5' };
    }
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        const s = getToastStyle(toast.type);
        return (
          <div
            key={toast.id}
            className="toast"
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderLeft: `4px solid ${s.accent}`,
            }}
            onClick={() => removeToast(toast.id)}
          >
            <span className="toast-msg">{toast.message}</span>
            <button className="toast-close">✕</button>
          </div>
        );
      })}

      <style>{`
        .toast-container {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 300px;
        }
        .toast {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border-radius: var(--radius);
          padding: 10px 12px;
          cursor: pointer;
          animation: slidein 300ms ease;
          backdrop-filter: blur(8px);
        }
        .toast-msg {
          flex: 1;
          font-size: 13px;
          color: var(--text-primary);
          line-height: 1.4;
        }
        .toast-close {
          font-size: 11px;
          color: var(--text-secondary);
          background: none;
          padding: 0;
          border: none;
          cursor: pointer;
        }
        .toast-close:hover { color: var(--text-primary); }
      `}</style>
    </div>
  );
}
