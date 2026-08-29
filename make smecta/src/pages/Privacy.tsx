import { useTranslation } from 'react-i18next';
import { Seo } from '../components/common/Seo';

const sections = ['intro', 'use', 'storage', 'rights', 'cookies'] as const;

export function Privacy() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('privacy.metaTitle')} description={t('privacy.introBody')} />
      <article className="container-shell section-space">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">{t('privacy.eyebrow')}</p>
          <h1 className="page-title mt-4">{t('privacy.title')}</h1>
          <p className="mt-3 text-sm text-ink-subtle">{t('privacy.updated')}</p>
          <div className="mt-10 space-y-10">
            {sections.map((key) => (
              <section key={key} id={key === 'cookies' ? 'cookies' : undefined} className="scroll-mt-28">
                <h2 className="section-title">{t(`privacy.${key}Title`)}</h2>
                <p className="mt-4 max-w-[68ch] leading-relaxed text-ink-muted">{t(`privacy.${key}Body`)}</p>
              </section>
            ))}
          </div>
        </div>
      </article>
    </>
  );
}
