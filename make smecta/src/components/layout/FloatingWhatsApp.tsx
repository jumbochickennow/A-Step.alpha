import { MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../../hooks/useLocale';
import { WHATSAPP_MESSAGES, whatsappHref } from '../../lib/constants';
import { track } from '../../services/analytics';

/** Minimum delay between accepted clicks (blocks rapid tab-opening loops). */
const CLICK_COOLDOWN_MS = 3000;

/**
 * Mobile-only floating WhatsApp button. Visibility is driven entirely by
 * IntersectionObserver: a zero-size sentinel sits at 40% (70% on /guides) of
 * the page height, so no scroll listener and no layout reads on scroll. Hidden
 * while the footer is on screen, while a field has focus, and while any dialog
 * holds the body scroll lock (`body.overflow-locked`, set by ui/Dialog).
 */
export function FloatingWhatsApp() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const lastClickAt = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isGuides = /\/guides\/?$/.test(pathname);
  // Locale-missing fallback keeps the pre-filled text strictly defined.
  const message = WHATSAPP_MESSAGES[locale] ?? WHATSAPP_MESSAGES.en;
  const href = whatsappHref(message);

  /** Blocks rapid consecutive activations so tabs cannot be opened in a loop. */
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    track('whatsapp_click', { source: 'floating_mobile' });
    const now = Date.now();
    if (now - lastClickAt.current < CLICK_COOLDOWN_MS) {
      event.preventDefault();
      return;
    }
    lastClickAt.current = now;
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    let passedSentinel = false;
    let footerVisible = false;
    let fieldFocused = false;
    let dialogOpen = document.body.classList.contains('overflow-locked');
    const update = () => setVisible(passedSentinel && !footerVisible && !fieldFocused && !dialogOpen);
    // The sentinel has scrolled past (or is on screen) once its top is above the viewport bottom.
    const sentinelObserver = new IntersectionObserver(([entry]) => {
      passedSentinel = entry.boundingClientRect.top <= (entry.rootBounds?.height ?? window.innerHeight);
      update();
    });
    sentinelObserver.observe(sentinel);
    const footer = document.getElementById('astep-footer');
    const footerObserver = new IntersectionObserver(([entry]) => { footerVisible = entry.isIntersecting; update(); });
    if (footer) footerObserver.observe(footer);
    const lockObserver = new MutationObserver(() => {
      const next = document.body.classList.contains('overflow-locked');
      if (next !== dialogOpen) { dialogOpen = next; update(); }
    });
    lockObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const focusIn = (event: FocusEvent) => { fieldFocused = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement; update(); };
    const focusOut = () => { fieldFocused = false; update(); };
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    return () => {
      sentinelObserver.disconnect();
      footerObserver.disconnect();
      lockObserver.disconnect();
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
    };
  }, [pathname]);

  return (
    <>
      {/* <body> is position: relative, so a percentage top resolves against the full page height. */}
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute start-0 h-px w-px" style={{ top: isGuides ? '70%' : '40%' }} />
      {visible ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('common.whatsappLabel')}
          onClick={handleClick}
          className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] end-[calc(1.25rem+env(safe-area-inset-right))] z-40 grid size-14 place-items-center rounded-full bg-blue-600 text-white shadow-md transition-[transform,background-color] duration-base hover:-translate-y-0.5 hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-blue-500 md:hidden motion-reduce:hover:transform-none"
        >
          <MessageCircle size={24} aria-hidden="true" />
        </a>
      ) : null}
    </>
  );
}
