import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EmptyState, ErrorState, CardGridSkeleton } from '../components/common/States';
import { FilterChips } from '../components/common/FilterChips';
import { Seo } from '../components/common/Seo';
import { GuideCard } from '../components/guides/GuideCard';
import { useGuides } from '../hooks/useContent';
import { useLocale } from '../hooks/useLocale';
import { CATEGORIES, categoryLabel } from '../lib/constants';
import { track } from '../services/analytics';
import { WhatsAppCTA } from '../components/common/WhatsAppCTA';

export function Guides() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const query = useGuides(locale);
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const filtered = useMemo(() => query.data?.filter((guide) => !category || guide.category === category) ?? [], [category, query.data]);
  const setCategory = (value: string) => {
    setParams(value ? { category: value } : {}, { replace: true });
    if (value) track('filter_used', { surface: 'guides', value });
  };

  return (
    <>
      <Seo title={t('guides.metaTitle')} description={t('guides.metaDescription')} />
      <header className="relative isolate overflow-hidden pb-24 pt-40 text-center md:pb-32 md:pt-48">
        <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-white/[0.035]" viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-80 180C120 20 210 380 420 190S760 60 900 230s260 20 390-80" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M-60 205C130 55 250 395 440 215S770 90 915 250s260 30 370-60" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M-20 150C160 0 310 340 490 165S820 30 980 190s220 15 320-95" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        <div className="container-shell flex min-h-[19rem] flex-col items-center justify-center">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-coral">{t('guides.eyebrow')}</p>
          <h1 className="mx-auto mt-5 max-w-[20ch] text-4xl font-extrabold leading-tight md:text-5xl">{t('guides.title')}</h1>
          <p className="mx-auto mt-5 max-w-[62ch] text-base leading-relaxed text-ink-muted">{t('guides.body')}</p>
          <WhatsAppCTA label={t('home.hero.primary')} source="guides_hero" className="mt-7 rounded-md px-10 py-2 text-xs" />
        </div>
      </header>
      <section className="container-shell pb-24">
        <FilterChips
          label={t('guides.filterLabel')}
          selected={category}
          onChange={setCategory}
          options={[
            { value: '', label: t('guides.all') },
            ...CATEGORIES.map((item) => ({ value: item, label: categoryLabel(item, t) })),
          ]}
        />
        {/* Pricing/offers banner bar: sits directly between the filter chips and the guide cards grid. */}
        <div className="my-8 flex w-full flex-col items-center justify-between gap-3 rounded-2xl border border-border-strong bg-surface-1/60 px-6 py-3.5 text-center backdrop-blur-sm sm:flex-row sm:gap-4 sm:text-start">
          <p className="text-sm font-medium text-ink-muted md:text-base">{t('guides.pricingCta.banner')}</p>
          <WhatsAppCTA
            label={t('guides.pricingCta.button')}
            source="guides_pricing_banner"
            intent="pricing"
            variant="primary"
            className="min-h-11 shrink-0 gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:translate-y-0 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-[0.98] active:translate-y-0"
          />
        </div>
        <p className="sr-only" aria-live="polite">{t('guides.results', { count: filtered.length })}</p>
        <div>
          {query.isLoading ? <CardGridSkeleton /> : query.isError ? <ErrorState message={t('guides.error')} retry={() => void query.refetch()} /> : filtered.length === 0 ? (
            <EmptyState message={t('guides.empty')} action={<Button variant="ghost" onClick={() => setCategory('')}>{t('common.clearFilter')}</Button>} />
          ) : (
            <div className="grid grid-cols-1 gap-7 md:grid-cols-2">{filtered.map((guide) => <GuideCard key={guide.id} guide={guide} />)}</div>
          )}
        </div>
      </section>
      <section className="relative z-20 w-full overflow-x-clip">
        {/* Angled white panel hugging the section between the dark navy bands. bg + clip-path stay on this absolute layer (never the content wrapper) so the bleeding mousetrap is not decapitated. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 bg-white"
          style={{
            clipPath:
              'polygon(0 0, 34% 0, 37% 7%, 63% 7%, 66% 0, 100% 0, 100% 100%, 0 100%)',
          }}
        />
        {/* Vertical padding ladder guarantees content starts below the notch's deepest point on every breakpoint (notch is 7% of panel height — deepest on tall mobile panels). */}
        <div className="container-shell relative z-10 grid min-w-0 grid-cols-1 items-center gap-6 pb-8 pt-14 sm:pb-10 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:py-10">
          {/* TEXT */}
          <div className="z-20 flex w-full min-w-0 flex-col items-center text-center lg:col-span-7 lg:items-start lg:text-start">
            <h2 className="w-full max-w-sm text-xl font-extrabold leading-snug tracking-tight text-brand-blue sm:max-w-md sm:text-2xl md:text-3xl lg:max-w-lg lg:text-4xl">
              {t('guides.ctaTitle')}
            </h2>
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-600 sm:text-sm lg:justify-start">
              <span className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={3} aria-hidden="true" />{t('guides.freeQuotes')}</span>
              <span className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={3} aria-hidden="true" />{t('home.hero.trust.flexible')}</span>
            </div>
            <WhatsAppCTA
              label={t('guides.ctaButton')}
              source="guides_cta"
              variant="primary"
              className="mx-auto mt-5 min-h-11 rounded-full px-7 py-2.5 text-sm font-semibold shadow-sm transition-all hover:translate-y-0 hover:brightness-95 [&_svg]:order-2 lg:mx-0"
            />
          </div>

          {/* Illustration: negative vertical margins let the enlarged mousetrap bleed past the short white band into the dark sections, like the approved design. */}
          <div className="relative z-10 -my-4 flex min-w-0 items-center justify-center md:-my-14 lg:col-span-5 lg:-my-28 lg:justify-end">
            <img
              src="/assets/home/passport-trap.webp"
              width={700}
              height={900}
              sizes="(min-width: 1024px) 480px, (min-width: 768px) 420px, 80vw"
              alt={t('guides.ctaAlt')}
              loading="lazy"
              decoding="async"
              className="aspect-[7/9] h-auto w-[80vw] max-w-[340px] object-contain md:max-w-[420px] md:scale-110 lg:max-w-[480px]"
            />
          </div>
        </div>
      </section>
    </>
  );
}
