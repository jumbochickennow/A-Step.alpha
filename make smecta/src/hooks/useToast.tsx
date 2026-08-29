import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from '../components/ui/Toast';

/**
 * Accessible toast notifications.
 *
 * ```tsx
 * const { showToast, toast } = useToast();
 * showToast('Saved!', 'success');
 * toast.error('Something went wrong');
 * ```
 *
 * Must be called inside a <ToastProvider> boundary (mounted in main.tsx).
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within <ToastProvider>');
  return context;
}