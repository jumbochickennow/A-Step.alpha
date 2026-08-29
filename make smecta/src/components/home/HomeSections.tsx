import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { buttonStyles } from '../common/Button';
import { WhatsAppCTA } from '../common/WhatsAppCTA';

export function IntroSection() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const ref = useScrollReveal<HTMLElement>();
  const items = ['documents', 'database', 'college', 'route', 'consultation', 'interview'] as const;
  return (
    <section ref={ref} className="container-shell grid min-w-0 items-center gap-10 py-8 md:gap-14 md:py-12 lg:grid-cols-[0.88fr_1.12fr] lg:py-16">
      <div className="min-w-0">
        <h2 className="max-w-[17ch] text-3xl font-extrabold leading-[1.08] md:text-4xl">{t('home.intro.title')}</h2>
        <p className="mt-5 max-w-[58ch] text-sm leading-relaxed text-brand-coral">{t('home.intro.body')}</p>
        <div className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm font-medium text-white">
              <Check size={14} aria-hidden="true" />
              <span>{t(`home.intro.items.${item}`)}</span>
            </div>
          ))}
        </div>
        <Link to={localizedPath('/guides', locale)} className={buttonStyles('primary', 'mt-8 rounded-full px-6')}>{t('home.intro.cta')}</Link>
      </div>
      <div className="relative mx-auto w-full min-w-0 max-w-[440px]">
        <div className="absolute inset-12 rounded-[40%] bg-[rgb(14_123_229/0.12)] blur-3xl" />
        <img src="/assets/home/traveller.webp" width="743" height="955" alt={t('home.hero.visualAlt')} loading="lazy" decoding="async" className="relative mx-auto aspect-[743/955] h-auto w-full" />
      </div>
    </section>
  );
}

export function StorySection() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const ref = useScrollReveal<HTMLElement>();
  const features = ['consultant', 'guides', 'feedback', 'events'] as const;
  return (
    <section
      id="about"
      ref={ref}
      className="bg-slate-50 py-20 text-slate-900 md:py-28"
    >
      <div className="container-shell min-w-0">
        <header className="mx-auto min-h-[14rem] max-w-4xl text-center">
          <p className="eyebrow text-brand-coral">{t('home.aboutFeatures.eyebrow')}</p>
          <h2 className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-3xl font-extrabold leading-tight tracking-[-0.02em] text-slate-900 md:text-4xl">
            <span>{t('home.aboutFeatures.headingPrefix')}</span>
            <img src="/assets/logo/logo-blue.png" width="3020" height="1021" alt={t('home.aboutFeatures.brandName')} decoding="async" className="aspect-[3020/1021] h-auto w-[min(42vw,156px)] object-contain" />
          </h2>
          <p className="mx-auto mt-7 max-w-[78ch] text-sm leading-7 text-slate-600 md:text-base md:leading-8">{t('home.aboutFeatures.intro')}</p>
        </header>

        <div className="mx-auto mt-14 grid max-w-5xl gap-x-14 gap-y-10 md:grid-cols-2 md:gap-y-14" role="list">
          {features.map((feature) => (
            <article key={feature} role="listitem" className="group flex min-w-0 items-start gap-5 rounded-2xl p-2 transition duration-200 ease-out hover:-translate-y-1 hover:bg-white hover:shadow-[0_12px_28px_rgb(15_23_42/0.08)] motion-reduce:transform-none motion-reduce:transition-none">
              <span className="grid size-16 shrink-0 place-items-center" aria-hidden="true">
                <img src={`/assets/home/features/${feature}.png`} width="79" height="79" alt="" loading="lazy" decoding="async" className="aspect-square size-full object-contain transition duration-200 ease-out group-hover:scale-105 group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none" />
              </span>
              <div className="min-w-0 pt-1">
                <h3 className="text-base font-bold leading-snug text-slate-900">{t(`home.aboutFeatures.features.${feature}.title`)}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{t(`home.aboutFeatures.features.${feature}.body`)}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl min-w-0 items-center gap-8 border-t border-slate-200 pt-12 md:grid-cols-[minmax(0,1fr)_auto] md:pt-14">
          <div className="min-w-0">
            <h3 className="text-2xl font-extrabold leading-tight tracking-[-0.02em] text-slate-900 md:text-3xl">{t('home.aboutFeatures.cta.title')}</h3>
            {/* TODO: Replace with approved A-Step CTA copy. */}
            <p className="mt-4 max-w-[56ch] text-sm leading-7 text-slate-600">{t('home.aboutFeatures.cta.body')}</p>
          </div>
          <Link to={localizedPath('/opportunities', locale)} className={buttonStyles('primary', 'w-full rounded-lg px-7 md:w-auto')}>
            {t('home.aboutFeatures.cta.button')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ServicesSection() {
  const { t } = useTranslation();
  const keys = ['support', 'expert', 'affordable', 'personal', 'tailored', 'roadmap'] as const;
  return (
    <section className="container-shell py-20 md:py-28">
      <div className="text-center">
        <h2 className="text-3xl font-bold md:text-4xl">{t('home.services.title')}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-subtle">{t('home.services.body')}</p>
      </div>
      <div className="mx-auto mt-14 grid max-w-5xl gap-x-16 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
        {keys.map((key) => (
          <article key={key} className="flex items-start gap-4">
            <img src={`/assets/home/benefits/${key}.svg`} width="64" height="64" alt="" loading="lazy" decoding="async" className="aspect-square size-11 shrink-0 object-contain" />
            <div>
              <h3 className="text-sm font-bold">{t(`home.services.items.${key}.title`)}</h3>
              <p className="mt-3 text-xs leading-5 text-ink-muted">{t(`home.services.items.${key}.body`)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ConsultationBand() {
  const { t } = useTranslation();

  return (
    <section className="relative bg-white text-bg">
      {/* Clipped dark/white transition */}
      <div
        className="absolute inset-x-0 top-0 h-[8%] bg-white"
        style={{
          clipPath:
            'polygon(0 0, 12% 0, 14% 100%, 39% 100%, 41% 0, 100% 0, 100% 100%, 0 100%)',
        }}
      />

      <div className="container-shell relative z-10 grid min-w-0 items-center gap-8 py-12 lg:min-h-[390px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:py-10">
        {/* TEXT */}
        <div className="relative z-20 min-w-0">
          <h2 className="max-w-[20ch] text-3xl font-extrabold leading-[1.08] text-brand-blue md:text-4xl">
            {t('home.cta.title')}
          </h2>

          <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-slate-500">
            {t('home.cta.body')}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-xs text-brand-blue-text">
            <span className="inline-flex items-center gap-1">
              <Check size={13} />
              {t('home.hero.freeGuides')}
            </span>

            <span className="inline-flex items-center gap-1">
              <Check size={13} />
              {t('home.hero.trust.flexible')}
            </span>
          </div>

          <WhatsAppCTA
            label={t('home.cta.button')}
            source="home_consultation_band"
            variant="primary"
            className="mt-6 rounded-full [&_svg]:order-2"
          />
        </div>

        {/* NOTEBOOK */}
        <div className="relative z-10 flex min-w-0 justify-center lg:z-30 lg:h-full">
          <img
            src="/assets/home/steps-notepad.webp"
            width="736"
            height="946"
            alt={t('home.cta.imageAlt')}
            loading="lazy"
            decoding="async"
            className="relative mx-auto aspect-[368/473] h-auto w-full max-w-[280px] object-contain sm:max-w-[340px] md:max-w-[380px] lg:-my-24 lg:h-[500px] lg:w-auto lg:max-w-none xl:h-[530px]"
          />
        </div>
      </div>
    </section>
  );
}

export function SectionLink({ to, children }: { to: string; children: string }) {
  const { locale } = useLocale();
  return <Link to={localizedPath(to, locale)} className={buttonStyles('ghost', 'mt-8 w-full sm:w-fit')}>{children}</Link>;
}
