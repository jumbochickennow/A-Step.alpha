import { MessageCircle, Phone } from 'lucide-react';
import { useRef } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PRICING_WHATSAPP_MESSAGES,
  WHATSAPP_MESSAGES,
  generateWhatsAppMessage,
  whatsappHref,
  type WhatsAppInquiryType,
} from '../../lib/constants';
import { track } from '../../services/analytics';
import { useLocale } from '../../hooks/useLocale';
import { buttonStyles, type ButtonVariant } from './Button';

interface WhatsAppCTAProps {
  label?: string;
  source: string;
  /** Pre-filled WhatsApp message intent. Defaults to consultation booking. */
  intent?: 'consultation' | 'pricing';
  /** Contextual inquiry type — overrides `intent` when provided. */
  inquiryType?: WhatsAppInquiryType;
  /** Item title interpolated into the contextual inquiry message. */
  inquiryTitle?: string;
  /** Leading icon: WhatsApp glyph (default) or phone handset. */
  icon?: 'whatsapp' | 'phone';
  variant?: ButtonVariant;
  className?: string;
}

const ICONS = { whatsapp: MessageCircle, phone: Phone } as const;

/** Minimum delay between accepted clicks (blocks rapid tab-opening loops). */
const CLICK_COOLDOWN_MS = 3000;

export function WhatsAppCTA({ label, source, intent = 'consultation', inquiryType, inquiryTitle, icon = 'whatsapp', variant = 'primary', className }: WhatsAppCTAProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const lastClickAt = useRef(0);
  // Contextual inquiry templates take precedence over the static intent copy.
  const message = inquiryType
    ? generateWhatsAppMessage({ type: inquiryType, title: inquiryTitle ?? '', locale })
    : ((intent === 'pricing' ? PRICING_WHATSAPP_MESSAGES[locale] : WHATSAPP_MESSAGES[locale]) ?? WHATSAPP_MESSAGES.en);
  const href = whatsappHref(message);
  const Icon = ICONS[icon];

  /** Blocks rapid consecutive activations so tabs cannot be opened in a loop. */
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    track('whatsapp_click', { source });
    const now = Date.now();
    if (now - lastClickAt.current < CLICK_COOLDOWN_MS) {
      event.preventDefault();
      return;
    }
    lastClickAt.current = now;
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label ?? t('nav.consultation')} — ${t('common.whatsappLabel')}`}
      className={buttonStyles(variant, className)}
      onClick={handleClick}
    >
      <Icon aria-hidden="true" size={18} />
      {label ?? t('nav.consultation')}
    </a>
  );
}
