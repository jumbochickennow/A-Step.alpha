import { AlertCircle, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { WHATSAPP_MESSAGES, whatsappHref } from '../../lib/constants';
import { buttonStyles, Button } from './Button';

/**
 * Shimmer skeleton mirroring real card layouts so grid heights stay stable
 * while data loads — no layout shift when the skeletons resolve.
 */
export function CardSkeleton({ variant = 'guide', className }: { variant?: 'guide' | 'opportunity'; className?: string }) {
  if (variant === 'opportunity') {
    return (
      <div aria-hidden="true" className={cn('flex h-full min-w-0 animate-pulse flex-col', className)}>
        <div className="aspect-[3/2] w-full rounded-xl bg-surface-2" />
        <div className="mt-4 h-3 w-24 rounded bg-surface-2" />
        <div className="mt-3 h-5 w-3/4 rounded bg-surface-2" />
        <div className="mt-3 h-3 w-full rounded bg-surface-2" />
        <div className="mt-auto pt-5">
          <div className="h-11 w-32 rounded-full bg-surface-2" />
        </div>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn('flex h-full min-h-[270px] animate-pulse flex-col rounded-xl border border-border bg-[#212a3a] p-6 shadow-[0_10px_26px_rgb(0_0_0/0.35)] md:p-7', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="h-6 w-3/4 rounded bg-surface-2" />
        <div className="size-8 shrink-0 rounded-md bg-surface-2" />
      </div>
      <div className="mt-5 h-4 w-full rounded bg-surface-2" />
      <div className="mt-2 h-4 w-4/5 rounded bg-surface-2" />
      <div className="mt-auto flex items-end justify-between gap-5 pt-7">
        <div className="h-3 w-20 rounded bg-surface-2" />
        <div className="h-10 w-28 shrink-0 rounded-md bg-surface-2" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6, variant = 'guide' }: { count?: number; variant?: 'guide' | 'opportunity' }) {
  const { t } = useTranslation();
  return (
    <div className={cn('grid grid-cols-1 gap-6 md:grid-cols-2', variant === 'opportunity' && 'lg:grid-cols-3')} aria-label={t('common.loading')} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
}

/** Non-intrusive alert container with retry action and WhatsApp fallback. */
export function ErrorState({ message, retry, onRetry, whatsappFallback = true }: { message: string; retry?: () => void; onRetry?: () => void; whatsappFallback?: boolean }) {
  const { t } = useTranslation();
  const handleRetry = onRetry ?? retry;
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border border-[rgb(248_113_113/0.35)] bg-[rgb(248_113_113/0.08)] px-6 py-12 text-center"
    >
      <span className="relative grid size-14 place-items-center rounded-full bg-[rgb(248_113_113/0.12)]">
        <span className="absolute inset-0 -z-10 rounded-full bg-[rgb(248_113_113/0.25)] blur-lg" aria-hidden="true" />
        <AlertCircle className="text-[var(--danger)]" size={26} aria-hidden="true" />
      </span>
      <p className="mt-5 max-w-[48ch] text-sm leading-relaxed text-ink-muted">{message}</p>
      <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
        {handleRetry ? (
          <Button variant="outline" size="sm" onClick={handleRetry}>{t('common.tryAgain')}</Button>
        ) : null}
        {whatsappFallback ? (
          <a
            href={whatsappHref(WHATSAPP_MESSAGES.en)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles('whatsapp', 'min-h-11 px-5 py-2.5 text-xs')}
          >
            {t('common.needHelp')}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Branded empty state: glowing icon, optional heading, message, action slot. */
export function EmptyState({ title, message, action, icon }: { title?: string; message: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="relative grid size-16 place-items-center rounded-full bg-brand-blue/10 text-brand-blue-text">
        <span className="absolute inset-0 -z-10 rounded-full bg-brand-blue/30 blur-xl" aria-hidden="true" />
        {icon ?? <Inbox size={28} aria-hidden="true" />}
      </span>
      {title ? <h3 className="mt-5 text-lg font-bold">{title}</h3> : null}
      <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-ink-muted">{message}</p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

/** Branded full-page spinner shown while lazy route chunks download. */
export function PageLoadingFallback({ minHeight = 'min-h-[70vh]' }: { minHeight?: string }) {
  return (
    <div
      className={`w-full ${minHeight} flex flex-col items-center justify-center p-8 transition-opacity duration-200`}
      role="status"
      aria-label="Loading page content"
    >
      <div className="relative flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
