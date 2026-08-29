import { useTranslation } from 'react-i18next';
import { Seo } from '../components/common/Seo';

const sections = ['scope', 'guarantee', 'accuracy', 'conduct', 'contact'] as const;

export function Terms() {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t('terms.metaTitle')} description={t('terms.scopeBody')} />
      <article className="container-shell section-space">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">{t('terms.eyebrow')}</p>
          <h1 className="page-title mt-4">{t('terms.title')}</h1>
          <p className="mt-3 text-sm text-ink-subtle">{t('terms.updated')}</p>
          <div className="mt-10 space-y-10">
            {sections.map((key) => <section key={key}><h2 className="section-title">{t(`terms.${key}Title`)}</h2><p className="mt-4 max-w-[68ch] leading-relaxed text-ink-muted">{t(`terms.${key}Body`)}</p></section>)}
          </div>
        </div>
      </article>
    </>
  );
}
