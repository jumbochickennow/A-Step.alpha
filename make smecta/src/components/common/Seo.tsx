import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localeFromPath } from '../../hooks/useLocale';

interface FaqEntry {
  question: string;
  answer: string;
}

interface SeoProps {
  title: string;
  description: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Renders FAQPage structured data for the current route. */
  faqs?: FaqEntry[];
}

/** Route segment → existing i18n label keys (verified by check-translations). */
const SEGMENT_LABEL_KEYS: Record<string, string> = {
  guides: 'nav.guides',
  opportunities: 'nav.opportunities',
  about: 'nav.about',
  contact: 'nav.contact',
  privacy: 'footer.privacy',
  terms: 'footer.terms',
};

function prettifySegment(segment: string): string {
  return decodeURIComponent(segment).replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Seo({ title, description, noindex, jsonLd, faqs }: SeoProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const locale = localeFromPath(location.pathname);
  const base = (import.meta.env.VITE_SITE_URL || 'https://astep.example').replace(/\/$/, '');
  const canonical = `${base}${location.pathname}`;
  const stripped = location.pathname.replace(/^\/(fr|ar)(?=\/|$)/, '') || '/';
  const alternate = (target: 'en' | 'fr' | 'ar') => `${base}${target === 'en' ? stripped : `/${target}${stripped === '/' ? '/' : stripped}`}`;

  /* ---------------- Structured data (JSON-LD) ---------------- */

  type Schema = Record<string, unknown>;

  // Organization — brand identity for rich results.
  const organizationSchema: Schema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'A-Step',
    url: base,
    logo: `${base}/icon-512.png`,
    description: 'International Education & Career Consulting for Algerian and North African Students',
    sameAs: ['https://facebook.com', 'https://instagram.com', 'https://linkedin.com'],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+213555123456',
      contactType: 'customer support',
      availableLanguage: ['Arabic', 'French', 'English'],
    },
  };

  // BreadcrumbList — dynamically derived from the current URL path.
  const breadcrumbSchemas: Schema[] = [];
  if (stripped !== '/') {
    const segments = stripped.split('/').filter(Boolean);
    const items: Array<{ name: string; url: string }> = [{ name: 'A-Step', url: `${base}/` }];
    let accumulated = '';
    for (const segment of segments) {
      accumulated += `/${segment}`;
      const labelKey = SEGMENT_LABEL_KEYS[segment];
      items.push({
        name: labelKey ? t(labelKey) : prettifySegment(segment),
        url: `${base}/${locale === 'en' ? '' : `${locale}/`}${accumulated.replace(/^\//, '')}`.replace(/\/$/, '') || `${base}${accumulated}`,
      });
    }
    breadcrumbSchemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  // FAQPage — opt-in via the `faqs` prop.
  const faqSchemas: Schema[] = (faqs?.length
    ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      }]
    : []);

  const providedSchemas: Schema[] = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const structuredData: Schema[] = [
    organizationSchema,
    ...breadcrumbSchemas,
    ...faqSchemas,
    ...providedSchemas,
  ];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex,nofollow" /> : null}
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en" href={alternate('en')} />
      <link rel="alternate" hrefLang="fr" href={alternate('fr')} />
      <link rel="alternate" hrefLang="ar" href={alternate('ar')} />
      <link rel="alternate" hrefLang="x-default" href={alternate('en')} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content={locale === 'ar' ? 'ar_DZ' : locale === 'fr' ? 'fr_DZ' : 'en_DZ'} />
      <meta property="og:site_name" content="A-Step Immigration Space" />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={`${base}/og/default.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      {structuredData.map((schema, index) => (
        <script key={`structured-data-${index}`} type="application/ld+json">{JSON.stringify(schema)}</script>
      ))}
    </Helmet>
  );
}
