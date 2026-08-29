import { cn } from '../../lib/utils';
import type { ReactNode } from 'react';

export interface SectionHeadingProps {
  /** Small uppercase kicker line above the title. */
  eyebrow?: string;
  /** Pill tag rendered above the title (e.g. "POPULAR OPPORTUNITIES"). */
  badge?: string;
  title: string;
  /** Descriptive paragraph below the title. */
  body?: string;
  /** Preferred alias for `body`. */
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

export function SectionHeading({ eyebrow, badge, title, body, subtitle, centered, className }: SectionHeadingProps): ReactNode {
  const description: string = subtitle ?? body ?? '';

  return (
    <div className={cn('max-w-[68ch]', centered && 'mx-auto text-center', className)}>
      {badge ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-coral/40 bg-brand-coral/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-coral">
          <bdi>{badge}</bdi>
        </span>
      ) : null}
      {eyebrow ? <p className={cn('eyebrow', badge && 'mt-3')}>{eyebrow}</p> : null}
      <h2 className={cn('text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl', Boolean(badge || eyebrow) && 'mt-3')}>
        <bdi>{title}</bdi>
      </h2>
      {description ? (
        <p className={cn('mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg', centered && 'mx-auto')}>
          <bdi>{description}</bdi>
        </p>
      ) : null}
    </div>
  );
}
