import type { Locale, LocalizedText, OpportunityCategory, OpportunityStatus } from '../types/content';

export const LOCALES: Locale[] = ['en', 'fr', 'ar'];
export const COUNTRIES = ['Algeria', 'France', 'Italy', 'Canada', 'China', 'Germany', 'Poland', 'Gulf'] as const;
export const TOPICS = ['Scholarships', 'Universities', 'Visas', 'Cabin Crew'] as const;
export const CATEGORIES = [...COUNTRIES, ...TOPICS] as const;

/* ------------------------------------------------------------------ */
/* Readonly registries & runtime type guards (Task 3.2)                */
/* ------------------------------------------------------------------ */

export const SUPPORTED_LOCALES: readonly Locale[] = ['ar', 'en', 'fr'] as const;

export const OPPORTUNITY_CATEGORIES: readonly OpportunityCategory[] = [
  'scholarship',
  'internship',
  'job',
  'study_program',
  'visa_guide',
  'cabin_crew',
] as const;

export const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = [
  'open',
  'closing_soon',
  'closed',
  'archived',
] as const;

/** Runtime guard narrowing an unknown value to a supported Locale. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Runtime guard narrowing an unknown value to an OpportunityCategory. */
export function isOpportunityCategory(value: unknown): value is OpportunityCategory {
  return typeof value === 'string' && (OPPORTUNITY_CATEGORIES as readonly string[]).includes(value);
}

/** Runtime guard narrowing an unknown value to an OpportunityStatus. */
export function isOpportunityStatus(value: unknown): value is OpportunityStatus {
  return typeof value === 'string' && (OPPORTUNITY_STATUSES as readonly string[]).includes(value);
}

/**
 * Resolves localized copy for a locale with graceful cascade:
 * active locale → English → French → Arabic → provided fallback.
 */
export function getLocalizedValue(
  text: LocalizedText | undefined | null,
  locale: Locale,
  fallback = '',
): string {
  if (!text) return fallback;
  return text[locale] || text.en || text.fr || text.ar || fallback;
}

export const WHATSAPP_MESSAGES: Record<Locale, string> = {
  en: 'Hello, I am interested in booking a consultation with A-Step.',
  fr: 'Bonjour, je souhaite réserver une consultation avec A-Step.',
  ar: 'مرحبًا، أرغب في حجز استشارة مع A-Step.',
};

// Pre-filled WhatsApp intake message for pricing/offers requests.
// The English value intentionally produces:
// https://wa.me/213783145805?text=Hello%20A-Step,%20I%20would%20like%20to%20know%20more%20about%20your%20prices%20and%20offers
export const PRICING_WHATSAPP_MESSAGES: Record<Locale, string> = {
  en: 'Hello A-Step, I would like to know more about your prices and offers',
  fr: 'Bonjour A-Step, je souhaite en savoir plus sur vos tarifs et offres',
  ar: 'مرحبًا A-Step، أرغب في معرفة المزيد عن أسعاركم وعروضكم',
};

export const localeNames: Record<Locale, string> = {
  en: 'EN',
  fr: 'FR',
  ar: 'AR',
};

const categoryKeys: Record<string, string> = {
  Algeria: 'algeria', France: 'france', Italy: 'italy', Canada: 'canada', China: 'china', Germany: 'germany', Poland: 'poland', Gulf: 'gulf', Europe: 'europe',
  Scholarships: 'scholarships', Universities: 'universities', Visas: 'visas', 'Cabin Crew': 'cabinCrew',
};

export function categoryLabel(category: string, translate: (key: string) => string) {
  return categoryKeys[category] ? translate(`categories.${categoryKeys[category]}`) : category;
}

/**
 * Builds an encoded https://wa.me deep link for the configured A-Step number,
 * falling back to the default number when the env value is missing/malformed.
 */
export function whatsappHref(message: string): string {
  const digits = import.meta.env.VITE_WHATSAPP_NUMBER?.replace(/\D/g, '') ?? '';
  const number = digits.length >= 8 ? digits : '213783145805';
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/* ------------------------------------------------------------------ */
/* Contextual WhatsApp conversion templates (Task 4.1)                 */
/* ------------------------------------------------------------------ */

export type WhatsAppInquiryType =
  | 'general'
  | 'guide'
  | 'opportunity'
  | 'campus_france'
  | 'germany'
  | 'italy'
  | 'spain'
  | 'canada'
  | 'china'
  | 'cabin_crew';

export interface WhatsAppHrefOptions {
  type?: WhatsAppInquiryType;
  title?: string;
  locale?: Locale;
}

/** Pre-filled, locale-aware inquiry templates per destination/service. */
const WHATSAPP_TEMPLATES: Record<Locale, Record<WhatsAppInquiryType, (title: string) => string>> = {
  fr: {
    general: () => 'Bonjour A-Step, je souhaite avoir plus d’informations sur vos services d’accompagnement.',
    guide: (title: string) => `Bonjour A-Step, je souhaite obtenir des informations concernant le guide : ${title}`,
    opportunity: (title: string) => `Bonjour A-Step, je suis intéressé(e) par cette opportunité : ${title}`,
    campus_france: () => 'Bonjour A-Step, je souhaite être accompagné pour la procédure Campus France.',
    germany: () => 'Bonjour A-Step, je m’intéresse aux études en Allemagne et à la recherche d’admission.',
    italy: () => 'Bonjour A-Step, je souhaite postuler aux bourses et universités en Italie.',
    spain: () => 'Bonjour A-Step, je souhaite des conseils pour mes études en Espagne.',
    canada: () => 'Bonjour A-Step, je souhaite des renseignements sur le permis d’études pour le Canada.',
    china: () => 'Bonjour A-Step, je souhaite des détails sur les bourses et universités en Chine.',
    cabin_crew: () => 'Bonjour A-Step, je souhaite des informations sur le mentorat Cabin Crew (Hôtesse de l’air / Steward).',
  },
  en: {
    general: () => 'Hello A-Step, I would like to get more information about your consulting services.',
    guide: (title: string) => `Hello A-Step, I would like to inquire about the guide: ${title}`,
    opportunity: (title: string) => `Hello A-Step, I am interested in this opportunity: ${title}`,
    campus_france: () => 'Hello A-Step, I would like guidance for the Campus France procedure.',
    germany: () => 'Hello A-Step, I am interested in studying in Germany.',
    italy: () => 'Hello A-Step, I want to apply for scholarships and universities in Italy.',
    spain: () => 'Hello A-Step, I would like guidance on studying in Spain.',
    canada: () => 'Hello A-Step, I would like information regarding the Canadian student visa process.',
    china: () => 'Hello A-Step, I would like details about scholarships and universities in China.',
    cabin_crew: () => 'Hello A-Step, I would like information regarding Cabin Crew mentorship.',
  },
  ar: {
    general: () => 'مرحباً A-Step، أود الحصول على مزيد من المعلومات حول خدمات التوجيه والمرافقة.',
    guide: (title: string) => `مرحباً A-Step، أود الاستفسار بخصوص الدليل: ${title}`,
    opportunity: (title: string) => `مرحباً A-Step، أنا مهتم بهذه الفرصة: ${title}`,
    campus_france: () => 'مرحباً A-Step، أود المرافقة في إجراءات كامبوس فرانس (Campus France).',
    germany: () => 'مرحباً A-Step، أنا مهتم بالدراسة في ألمانيا والتسجيل الجامعي.',
    italy: () => 'مرحباً A-Step، أود التقديم على المنح والجامعات في إيطاليا.',
    spain: () => 'مرحباً A-Step، أود الحصول على استشارة للدراسة في إسبانيا.',
    canada: () => 'مرحباً A-Step، أود الاستفسار حول تأشيرة الدراسة في كندا.',
    china: () => 'مرحباً A-Step، أود معرفة تفاصيل المنح والجامعات في الصين.',
    cabin_crew: () => 'مرحباً A-Step، أود الاستفسار حول تدريب وإعداد طاقم الضيافة الجوية (Cabin Crew).',
  },
};

/**
 * Builds the contextual pre-filled WhatsApp inquiry text for the active locale,
 * target service/destination and (optionally) the item title.
 */
export function generateWhatsAppMessage(options: WhatsAppHrefOptions = {}): string {
  const { type = 'general', title = '', locale = 'fr' } = options;
  const localeTemplates = WHATSAPP_TEMPLATES[locale] ?? WHATSAPP_TEMPLATES.fr;
  const template = localeTemplates[type] ?? localeTemplates.general;
  const trimmedTitle = title.trim();
  return template(trimmedTitle);
}

/** Convenience wrapper: contextual message → encoded wa.me deep link. */
export function whatsappHrefFor(options: WhatsAppHrefOptions = {}): string {
  return whatsappHref(generateWhatsAppMessage(options));
}
