import { MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';
import { WHATSAPP_MESSAGES } from '../../lib/constants';
import { track } from '../../services/analytics';

/** Fallback number used when VITE_WHATSAPP_NUMBER is missing or malformed. */
const FALLBACK_WHATSAPP_NUMBER = '213783145805';
/** Minimum delay between accepted clicks (blocks rapid tab-opening loops). */
const CLICK_COOLDOWN_MS = 3000;

/** Normalizes the configured number to digits only, with a safe fallback. */
function resolveWhatsappNumber(raw: string | undefined): string {
  const digits = raw?.replace(/\D/g, '') ?? '';
  return digits.length >= 8 ? digits : FALLBACK_WHATSAPP_NUMBER;
}

export function FloatingWhatsApp() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);
  const lastClickAt = useRef(0);
  const number = resolveWhatsappNumber(import.meta.env.VITE_WHATSAPP_NUMBER);
  // Locale-missing fallback keeps the pre-filled text strictly defined.
  const message = WHATSAPP_MESSAGES[locale] ?? WHATSAPP_MESSAGES.en;
  const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

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
    let footerVisible = false;
    let fieldFocused = false;
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      setVisible(scrollable > 0 && scrollY / scrollable >= 0.4 && !footerVisible && !fieldFocused);
    };
    const footer = document.getElementById('astep-footer');
    const observer = new IntersectionObserver(([entry]) => { footerVisible = entry.isIntersecting; update(); });
    if (footer) observer.observe(footer);
    const focusIn = (event: FocusEvent) => { fieldFocused = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement; update(); };
    const focusOut = () => { fieldFocused = false; update(); };
    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
    };
  }, []);

  if (!visible) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('common.whatsappLabel')}
      onClick={handleClick}
      className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] end-[calc(1.25rem+env(safe-area-inset-right))] z-40 grid size-14 place-items-center rounded-full bg-blue-600 text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-blue-500 md:hidden motion-reduce:hover:transform-none"
    >
      <MessageCircle size={24} aria-hidden="true" />
    </a>
  );
}
