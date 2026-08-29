import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

/**
 * Accessible notification context. Consumed via the `useToast()` hook
 * (src/hooks/useToast.tsx) inside a <ToastProvider> boundary.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_STYLES: Record<ToastType, { border: string; icon: string; Icon: typeof Info }> = {
  success: { border: 'border-[rgb(52_211_153/0.45)]', icon: 'text-[var(--success)]', Icon: CheckCircle2 },
  error: { border: 'border-[rgb(248_113_113/0.5)]', icon: 'text-[var(--danger)]', Icon: XCircle },
  info: { border: 'border-brand-blue/50', icon: 'text-brand-blue-text', Icon: Info },
};

let toastSequence = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, number>());
  const expiries = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    expiries.current.delete(id);
  }, []);

  /** Auto-dismisses after `duration` ms; hover pauses, leave resumes. */
  const scheduleDismiss = useCallback((id: string, duration: number) => {
    const element = document.getElementById(`toast-${id}`);
    if (!element) return;
    const remaining = Math.max(duration, 400);
    expiries.current.set(id, Date.now() + remaining);
    const timer = window.setTimeout(() => dismiss(id), remaining);
    timers.current.set(id, timer);

    const pause = () => {
      const pending = timers.current.get(id);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        timers.current.delete(id);
        expiries.current.set(id, Math.max((expiries.current.get(id) ?? Date.now()) - Date.now(), 400));
      }
    };
    const resume = () => scheduleDismiss(id, expiries.current.get(id) ?? duration - Date.now());
    element.addEventListener('mouseenter', pause, { once: true });
    element.addEventListener('mouseleave', resume, { once: true });
  }, [dismiss]);

  const showToast = useCallback((message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
    const id = `t${Date.now().toString(36)}-${(toastSequence += 1)}`;
    setToasts((current) => [...current.slice(-3), { id, type, title, message, duration }]);
    // Defer scheduling so the DOM node exists for hover listeners.
    requestAnimationFrame(() => scheduleDismiss(id, duration));
  }, [scheduleDismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    toast: {
      success: (message, title) => showToast(message, 'success', title),
      error: (message, title) => showToast(message, 'error', title),
      info: (message, title) => showToast(message, 'info', title),
    },
  }), [showToast]);

  // Clear any pending timers when the provider unmounts.
  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Logical end placement keeps the stack mirrored in RTL; z-[60] sits above dialogs (z-50). */}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] end-[calc(1rem+env(safe-area-inset-right))] z-[60] flex w-[min(92vw,360px)] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const { border, icon, Icon } = TYPE_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              id={`toast-${toast.id}`}
              role="status"
              aria-live="polite"
              className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface-1 p-4 shadow-modal backdrop-blur-sm', border)}
            >
              <Icon size={20} aria-hidden="true" className={cn('mt-0.5 shrink-0', icon)} />
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold text-ink">{toast.title}</p> : null}
                <p className="text-sm leading-snug text-ink-muted">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-me-1 -mt-1 grid min-h-8 min-w-8 place-items-center rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
