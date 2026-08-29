import { useTranslation } from 'react-i18next';
import { FaqList, faqKeys } from '../components/common/FaqList';
import { Seo } from '../components/common/Seo';
import { SectionHeading } from '../components/common/SectionHeading';
import { ServicesSection } from '../components/home/HomeSections';
import { WhatsAppCTA } from '../components/common/WhatsAppCTA';

export function About() {
  const { t } = useTranslation();
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqKeys.map((key) => ({
      '@type': 'Question',
      name: t(`about.faq.${key}.q`),
      acceptedAnswer: { '@type': 'Answer', text: t(`about.faq.${key}.a`) },
    })),
  };
  return (
    <>
      <Seo title={t('about.metaTitle')} description={t('about.metaDescription')} jsonLd={faqLd} />
      <header className="section-space container-shell grid items-center gap-12 lg:grid-cols-[1.06fr_0.94fr]">
        <div className="flex min-h-[20rem] flex-col justify-center">
          <p className="eyebrow">{t('about.eyebrow')}</p>
          <h1 className="page-title mt-4 max-w-[18ch]">{t('about.title')}</h1>
          <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-ink-muted">{t('about.intro')}</p>
          <WhatsAppCTA
            label={t('guides.pricingCta.button')}
            source="about_hero_pricing"
            intent="pricing"
            variant="primary"
            className="mt-6 min-h-11 gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:translate-y-0 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-[0.98] active:translate-y-0"
          />
        </div>
        <div className="relative min-h-[340px] overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_70%_30%,rgb(77_163_245/0.22),transparent_45%),linear-gradient(145deg,#1a2130,#10151e)] p-6 md:min-h-[420px] md:p-8">
          <img src="/assets/about/laptop.png" width="1254" height="1254" alt={t('home.story.imageAlt')} decoding="async" className="absolute inset-x-0 bottom-0 mx-auto aspect-square h-auto w-[min(100%,340px)] object-contain md:w-[min(100%,420px)]" />
        </div>
      </header>

      <section className="bg-brand-blue py-16 md:py-24">
        <div className="container-shell grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="section-title">{t('about.storyTitle')}</h2>
            <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-white/85">{t('about.storyBody')}</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-6 md:p-8">
            <h2 className="section-title">{t('about.whoTitle')}</h2>
            <p className="mt-5 leading-relaxed text-white/85">{t('about.whoBody')}</p>
          </div>
        </div>
      </section>

      <ServicesSection />

      <section id="faq" className="section-space scroll-mt-24 border-t border-border bg-[#101620]">
        <div className="container-shell grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <SectionHeading eyebrow={t('about.faqEyebrow')} title={t('about.faqTitle')} />
          <FaqList />
        </div>
      </section>
    </>
  );
}
