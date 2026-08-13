import { useToastStore } from '../../stores/toastStore';

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <span className="toast-msg">{toast.message}</span>
          <button className="toast-close">x</button>
        </div>
      ))}

      <style>{`
        .toast-container {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 400px;
        }
        .toast {
          padding: 12px 16px;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          animation: slideIn 0.2s ease-out;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .toast-error {
          background: #2d1418;
          border: 1px solid var(--danger);
          color: var(--danger);
        }
        .toast-success {
          background: #142d1a;
          border: 1px solid var(--success);
          color: var(--success);
        }
        .toast-info {
          background: #14202d;
          border: 1px solid var(--accent);
          color: var(--accent);
        }
        .toast-msg { flex: 1; }
        .toast-close {
          background: none;
          color: inherit;
          padding: 2px 6px;
          font-size: 11px;
          opacity: 0.7;
        }
        .toast-close:hover { opacity: 1; }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
