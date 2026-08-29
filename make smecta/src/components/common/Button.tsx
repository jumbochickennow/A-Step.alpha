import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'whatsapp' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Variant design tokens. Palette adapts the spec to the dark-first brand:
 * structural classes (active scale, focus ring, tints) match the spec exactly,
 * while neutral surfaces map to theme-aware equivalents.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white font-medium shadow-md hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:ring-blue-500',
  secondary: 'bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:text-primary-light',
  outline: 'border-2 border-slate-200 bg-transparent text-ink hover:border-primary hover:text-primary dark:border-slate-700',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  whatsapp: 'bg-blue-600 text-white font-medium shadow-md hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:ring-blue-500',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-xs',
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  lg: 'min-h-[50px] px-6 py-3.5 text-base font-semibold',
};

const BASE_STYLES =
  'inline-flex max-w-full select-none items-center justify-center gap-2 whitespace-normal rounded-md text-center font-semibold leading-snug transition-all duration-200 ease-out active:scale-[0.98] [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 motion-reduce:hover:transform-none motion-reduce:active:scale-100';

export function buttonStyles(variant: ButtonVariant = 'primary', className?: string, size: ButtonSize = 'md') {
  return cn(BASE_STYLES, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows an inline spinner, sets aria-busy, blocks clicks, preserves width. */
  isLoading?: boolean;
  /** Leading icon — flows automatically in LTR/RTL layouts. */
  leftIcon?: ReactNode;
  /** Trailing icon — flows automatically in LTR/RTL layouts. */
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={buttonStyles(variant, className, size)}
      {...props}
    >
      {/* Invisible label under the spinner preserves the button's exact width. */}
      <span className="relative inline-flex min-w-0 items-center justify-center">
        <span className={cn('inline-flex min-w-0 items-center justify-center gap-2 [&_svg]:shrink-0', isLoading && 'invisible')}>
          {leftIcon}
          {children}
          {rightIcon}
        </span>
        {isLoading ? <Loader2 size={18} aria-hidden="true" className="absolute animate-spin" /> : null}
      </span>
    </button>
  ),
);

Button.displayName = 'Button';
