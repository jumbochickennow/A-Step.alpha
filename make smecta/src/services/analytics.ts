declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

export type AnalyticsEvent =
  | 'whatsapp_click'
  | 'guide_download_start'
  | 'guide_download_success'
  | 'newsletter_subscribe'
  | 'contact_submit'
  | 'filter_used'
  | 'language_switch';

export function initAnalytics() {
  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN?.trim();
  if (!domain || document.querySelector('script[data-astep-analytics]')) return;
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = domain;
  script.dataset.astepAnalytics = 'true';
  script.src = 'https://plausible.io/js/script.js';
  document.head.append(script);
}

export function track(event: AnalyticsEvent, props: Record<string, string> = {}) {
  window.plausible?.(event, { props });
}
