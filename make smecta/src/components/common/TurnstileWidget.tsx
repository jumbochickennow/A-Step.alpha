import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface TurnstileWidgetProps {
  /** Called once Turnstile issues a valid verification token. */
  onVerify: (token: string) => void;
  onError?: (error?: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  action: 'contact' | 'lead_download' | 'newsletter';
  className?: string;
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileRenderParams {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  action: 'contact' | 'lead_download' | 'newsletter';
  callback?: (token: string) => void;
  'error-callback'?: (error?: string) => void;
  'expired-callback'?: () => void;
}

interface TurnstileApi {
  render: (element: HTMLElement, params: TurnstileRenderParams) => string | undefined;
  remove: (widgetId?: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Singleton loader: the Turnstile script is injected into the head exactly once. */
let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no_window'));
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // Allow a retry on the next mount if the injection failed.
      turnstileScriptPromise = null;
      reject(new Error('turnstile_script_failed'));
    });
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

/** Resolves only an explicitly configured production site key. */
function resolveSiteKey(): string {
  return import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
}

/** The challenge is active only when a site key is explicitly configured. */
export function isTurnstileEnabled(): boolean {
  return Boolean(resolveSiteKey());
}

export function TurnstileWidget({ onVerify, onError, onExpire, theme = 'auto', size = 'normal', action, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  // Latest callbacks kept in a ref so re-renders never force a widget rebuild.
  const callbacksRef = useRef({ onVerify, onError, onExpire });
  callbacksRef.current = { onVerify, onError, onExpire };

  const siteKey = resolveSiteKey();

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || widgetIdRef.current !== undefined) return;
        const container = containerRef.current;
        if (!container || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          theme,
          size,
          action,
          callback: (token) => callbacksRef.current.onVerify(token),
          'error-callback': (error) => callbacksRef.current.onError?.(error),
          'expired-callback': () => callbacksRef.current.onExpire?.(),
        });
      })
      .catch((error?: string) => callbacksRef.current.onError?.(error));
    return () => {
      cancelled = true;
      if (widgetIdRef.current !== undefined && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [siteKey, theme, size, action]);

  return (
    <div
      ref={containerRef}
      className={cn('min-w-0', size === 'compact' ? 'min-h-[120px]' : 'min-h-[65px]', className)}
      aria-label="Cloudflare Turnstile verification"
    />
  );
}
