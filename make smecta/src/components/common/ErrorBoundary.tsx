import { Component, type ErrorInfo, type ReactNode } from 'react';
import { whatsappHrefFor } from '../../lib/constants';

interface ErrorBoundaryState {
  failed: boolean;
  error?: Error;
  info?: ErrorInfo;
}

/**
 * Branded crash recovery screen. Renders trilingual guidance (the i18n stack
 * itself may be the failure source) with three recovery paths: reload, home,
 * and a pre-filled WhatsApp support chat. In development an expandable
 * inspector exposes the error message and component stack.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A-Step render failure', error, info);
    this.setState({ info });
  }

  private openWhatsApp = (): void => {
    window.open(whatsappHrefFor({ type: 'general' }), '_blank', 'noopener,noreferrer');
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <main className="container-shell flex min-h-screen items-center justify-center py-16 text-center">
        <div className="card w-full max-w-xl p-8 md:p-10">
          <span className="relative mx-auto grid size-16 place-items-center rounded-full bg-[rgb(248_113_113/0.12)] text-[var(--danger)]">
            <span className="absolute inset-0 -z-10 rounded-full bg-[rgb(248_113_113/0.3)] blur-xl" aria-hidden="true" />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>

          <h1 className="page-title mt-6">Something went wrong</h1>
          {/* Trilingual guidance — rendered statically so it survives i18n failures. */}
          <div className="mt-4 space-y-1 text-sm leading-relaxed text-ink-muted" lang="und">
            <p>An unexpected error occurred.</p>
            <p lang="fr">Une erreur inattendue est survenue.</p>
            <p lang="ar" dir="rtl">حدث خطأ غير متوقع.</p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Reload Page · إعادة تحميل
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="min-h-11 rounded-md border-2 border-border-strong px-5 py-2.5 text-sm font-semibold text-ink transition-all duration-200 hover:border-primary hover:text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Go to Homepage · الرئيسية
            </button>
            <button
              type="button"
              onClick={this.openWhatsApp}
              className="min-h-11 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Ask on WhatsApp · واتساب
            </button>
          </div>

          {isDev ? (
            <details className="mt-8 rounded-md border border-border bg-surface-2 p-4 text-start">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Developer details
              </summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-start text-xs leading-relaxed text-[var(--danger)]">
                {this.state.error?.message}
                {this.state.info?.componentStack}
              </pre>
            </details>
          ) : null}
        </div>
      </main>
    );
  }
}
