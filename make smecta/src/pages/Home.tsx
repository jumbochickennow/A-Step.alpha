import { BadgeCheck, CalendarClock, Check, Clock3, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FaqList } from '../components/common/FaqList';
import { Seo } from '../components/common/Seo';
import { WhatsAppCTA } from '../components/common/WhatsAppCTA';
import { ConsultationBand, IntroSection, ServicesSection, StorySection } from '../components/home/HomeSections';
import { KineticTrustRow } from '../components/home/KineticTrustRow';
import { localizedPath, useLocale } from '../hooks/useLocale';

export function Home() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const trust = [
    [BadgeCheck, t('home.hero.trust.certified')],
    [Clock3, t('home.hero.trust.tracking')],
    [ShieldCheck, t('home.hero.trust.algerian')],
    [CalendarClock, t('home.hero.trust.flexible')],
  ] as const;
  const organizationLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'A-Step Immigration Space',
    url: import.meta.env.VITE_SITE_URL || 'https://www.astepimmigration.space',
  };

  return (
    <>
      <Seo title={t('home.metaTitle')} description={t('home.metaDescription')} jsonLd={organizationLd} />
      <section className="relative isolate overflow-hidden pt-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_12%,rgb(14_123_229/0.08),transparent_26rem)]" />
      <div className="container-shell flex min-h-[560px] flex-col items-center justify-center pb-8 text-center md:min-h-[520px] md:pb-10">
          <p className="min-h-5 text-xs text-ink-muted">{t('home.hero.eyebrow')}</p>
          <h1 className="mt-5 flex min-h-[8.75rem] max-w-[17ch] items-center justify-center text-4xl font-extrabold leading-[1.08] tracking-[-0.025em] md:min-h-[7rem] md:text-5xl">{t('home.hero.title')}</h1>
          <div className="mt-6 flex min-h-12 flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs font-medium text-brand-blue-text">
            <span className="inline-flex items-center gap-1.5"><Check size={15} strokeWidth={3} />{t('home.hero.freeGuides')}</span>
            <span className="inline-flex items-center gap-1.5"><Check size={15} strokeWidth={3} />{t('home.hero.consultationServices')}</span>
          </div>
          <WhatsAppCTA label={t('home.hero.primary')} source="home_hero" className="mt-7 rounded-full px-6 [&_svg]:order-2 [&_svg]:rounded-full [&_svg]:bg-white [&_svg]:p-1 [&_svg]:text-brand-blue" />

          <KineticTrustRow items={trust} />
        </div>
      </section>

      <IntroSection />
      <StorySection />
      <ServicesSection />
      <ConsultationBand />

      <section id="faq" className="py-20 md:py-28">
        <div className="container-shell grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <h2 className="max-w-[14ch] text-3xl font-bold leading-tight md:text-4xl">{t('home.faq.title')}</h2>
            <p className="mt-4 text-sm text-ink-muted">{t('home.faq.prompt')} <Link to={localizedPath('/contact', locale)} className="font-semibold text-brand-blue-text">{t('home.faq.contact')}</Link></p>
          </div>
          <FaqList limit={5} design />
        </div>
      </section>
    </>
  );
}
