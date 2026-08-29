import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Seo } from '../components/common/Seo';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/common/States';
import { WhatsAppCTA } from '../components/common/WhatsAppCTA';
import { FeaturedOpportunity } from '../components/opportunities/FeaturedOpportunity';
import { OpportunityCard } from '../components/opportunities/OpportunityCard';
import { useOpportunities } from '../hooks/useContent';
import { useLocale } from '../hooks/useLocale';
import { isPast } from '../lib/format';

export function Opportunities() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const query = useOpportunities(locale);
  const active = query.data?.filter((item) => !isPast(item.deadline)) ?? [];
  const featured = active.find((item) => item.featured) ?? active[3] ?? active[0];
  const regular = featured ? active.filter((item) => item.id !== featured.id) : active;
  const firstRow = regular.slice(0, 3);
  const remaining = regular.slice(3);

  return (
    <>
      <Seo title={t('opportunities.metaTitle')} description={t('opportunities.metaDescription')} />
      <header className="pb-16 pt-44 text-center md:pb-20 md:pt-56">
        <div className="container-shell flex min-h-[10rem] flex-col items-center justify-center">
          <h1 className="mx-auto max-w-[24ch] text-4xl font-bold leading-tight md:text-5xl">{t('opportunities.title')}</h1>
          <p className="mx-auto mt-5 max-w-[58ch] text-base leading-relaxed text-ink-muted">{t('opportunities.body')}</p>
        </div>
      </header>

      <section className="container-shell pb-28">
        {query.isLoading ? <CardGridSkeleton variant="opportunity" /> : query.isError ? <ErrorState message={t('opportunities.error')} retry={() => void query.refetch()} /> : !featured ? (
          <EmptyState message={t('opportunities.empty')} />
        ) : (
          <div className="mx-auto min-w-0 max-w-5xl">
            <div className="grid gap-x-8 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
              {firstRow.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
            </div>
            <div className="mt-24"><FeaturedOpportunity opportunity={featured} /></div>
            {remaining.length ? (
              <div className="mt-24 grid gap-x-8 gap-y-20 md:grid-cols-2 lg:grid-cols-3">
                {remaining.map((item) => <OpportunityCard key={item.id} opportunity={item} />)}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="relative z-20 w-full overflow-x-clip text-bg">
  {/* White banner band, inset within the dark page frame; the top-left notch is cut into
      the clipped background layer so the clock visual can bleed past the band's edges. */}
  <div className="relative my-8 md:my-14">
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 bg-white"
      style={{
        clipPath:
          'polygon(0 0, 14% 0, 17% 6%, 39% 6%, 42% 0, 100% 0, 100% 100%, 0 100%)',
      }}
    />

  {/* Content */}
  <div className="relative z-10 mx-auto grid w-full min-w-0 grid-cols-1 items-center gap-8 px-6 py-8 md:py-10 lg:grid-cols-12 lg:px-14">

    {/* Text */}
    <div className="relative z-10 min-w-0 lg:col-span-7">
      <h2 className="max-w-lg text-2xl font-extrabold leading-tight tracking-tight text-brand-blue sm:text-3xl lg:text-4xl">
        {t('opportunities.ctaTitle')}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 sm:text-sm">
        <span className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={3} aria-hidden="true" />{t('guides.freeQuotes')}</span>
        <span className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={3} aria-hidden="true" />{t('home.hero.trust.flexible')}</span>
      </div>

      <WhatsAppCTA
        label={t('guides.pricingCta.button')}
        source="opportunities_pricing_cta"
        intent="pricing"
        icon="phone"
        variant="primary"
        className="mt-6 min-h-11 gap-2 rounded-full px-7 py-2.5 text-sm font-semibold shadow-sm transition-all hover:translate-y-0 hover:brightness-95 active:translate-y-0 active:scale-[0.98] [&_svg]:order-2"
      />
    </div>

    {/* Alarm visual column: centered in-column with an inward leftward nudge on desktop */}
    <div className="relative z-10 flex min-w-0 items-center justify-center overflow-visible lg:col-span-5 lg:justify-center">
      <img
        src="/assets/home/alarm.webp"
        width={736}
        height={946}
        alt={t('opportunities.ctaAlt')}
        loading="lazy"
        decoding="async"
        className="pointer-events-none relative z-20 aspect-[368/473] h-auto w-auto object-contain max-h-[280px] sm:max-h-[340px] md:max-h-[420px] lg:max-h-[480px] xl:max-h-[520px] -my-6 sm:-my-10 md:-my-14 lg:-my-16 xl:-my-20 translate-y-1 md:translate-y-2 lg:-translate-x-6 xl:-translate-x-10"
      />
    </div>

  </div>
  </div>
</section>
    </>
  );
}
