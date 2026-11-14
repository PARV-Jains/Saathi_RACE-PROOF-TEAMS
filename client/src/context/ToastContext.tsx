import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  code?: string;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, code }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, code };
      setToasts((prev) => [...prev, newToast]);

      const duration = type === 'error' ? 7000 : 4500;
      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
        aria-live="assertive"
      >
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-lg p-3.5 bg-zinc-900 border text-zinc-100 shadow-xl transition-all duration-200 ${
                isError
                  ? 'border-rose-900/60 ring-1 ring-rose-500/20'
                  : isSuccess
                  ? 'border-emerald-900/60 ring-1 ring-emerald-500/20'
                  : isWarning
                  ? 'border-amber-900/60 ring-1 ring-amber-500/20'
                  : 'border-zinc-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {isError ? (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  ) : isSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Info className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-xs tracking-tight text-zinc-100">{toast.title}</p>
                    {toast.code && (
                      <span className="font-mono text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-rose-300 font-medium">
                        {toast.code}
                      </span>
                    )}
                  </div>
                  {toast.message && (
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed break-words font-mono text-[11px]">
                      {toast.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
