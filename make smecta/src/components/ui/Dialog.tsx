import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/* ------------------------------------------------------------------ */
/* Scroll locking & dismissal helpers                                  */
/* ------------------------------------------------------------------ */

/** Reference count so stacked overlays never unlock each other prematurely. */
let bodyLockCount = 0;
let bodyOriginalPaddingRight = '';

/**
 * Locks background body scrolling while `active` is true. Compensates for the
 * vanished desktop scrollbar with an equal padding-right so the page does not
 * shift horizontally when the lock engages. Cleanup restores everything.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const { body } = document;
    const isFirstLock = bodyLockCount === 0;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (isFirstLock) {
      bodyOriginalPaddingRight = body.style.paddingRight;
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.classList.add('overflow-locked');
    bodyLockCount += 1;
    return () => {
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (bodyLockCount === 0) {
        body.classList.remove('overflow-locked');
        body.style.paddingRight = bodyOriginalPaddingRight;
        bodyOriginalPaddingRight = '';
      }
    };
  }, [active]);
}

function ScrollLockedOverlay() {
  // This component mounts inside Radix Presence, so it only locks while open.
  useBodyScrollLock(true);
  return <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[state=closed]:pointer-events-none" />;
}

/**
 * Standard Escape-key dismissal for overlays driven by local component state
 * (complements Radix Dialog's built-in Escape handling).
 */
export function useEscapeToClose(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);
}

export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ className, children, ...props }, ref) => {
    const { t } = useTranslation();
    return <DialogPrimitive.Portal>
      <ScrollLockedOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn('fixed start-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-1 p-6 shadow-modal rtl:translate-x-1/2 md:p-8', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute end-4 top-4 grid min-h-11 min-w-11 place-items-center rounded-full p-2.5 text-ink-muted transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white" aria-label={t('common.closeDialog')}>
          <X aria-hidden="true" size={20} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>;
  },
);
Dialog.displayName = 'Dialog';
DialogContent.displayName = 'DialogContent';

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
