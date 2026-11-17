import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (toast) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, tone: 'info', ...toast }]);
      setTimeout(() => dismiss(id), toast.duration ?? 6000);
    },
    [dismiss]
  );

  const tones = {
    success: 'border-signal-300 bg-signal-50',
    info: 'border-ink/10 bg-white',
    error: 'border-red-200 bg-red-50'
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`rounded-xl border p-4 shadow-card ${tones[t.tone]}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display font-semibold text-ink">{t.title}</p>
                {t.body && <p className="mt-1 text-sm text-ink-muted">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-ink-muted hover:text-ink" aria-label="Dismiss">×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
