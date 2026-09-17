import { useTranslation } from 'react-i18next';
import { Seo } from '../components/common/Seo';

/**
 * Placeholder stub — Resources page content is separate, design-pending work.
 * This route exists only so the navbar link does not dead-end into the 404
 * catch-all. Registered in App.tsx's shared `children` array, so all three
 * locale routers serve it.
 */
export function Resources() {
  const { t } = useTranslation();
  return (
    <>
      {/* noindex until real resources content lands — the navbar links here from every page. */}
      <Seo title={t('nav.resources')} description={t('common.comingSoon')} noindex />
      <section className="container-shell section-space">
        <div className="mx-auto max-w-3xl">
          <h1 className="page-title">{t('nav.resources')}</h1>
          <p className="mt-4 text-sm text-ink-muted">{t('common.comingSoon')}</p>
        </div>
      </section>
    </>
  );
}
