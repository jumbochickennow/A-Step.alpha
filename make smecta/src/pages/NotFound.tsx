import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonStyles } from '../components/common/Button';
import { Seo } from '../components/common/Seo';
import { localizedPath, useLocale } from '../hooks/useLocale';

export function NotFound() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  return (
    <section className="container-shell flex min-h-[70svh] items-center justify-center py-16 text-center">
      <Seo title={t('notFound.metaTitle')} description={t('notFound.body')} noindex />
      <div>
        <p className="eyebrow">{t('notFound.eyebrow')}</p>
        <h1 className="display-title mx-auto mt-4 max-w-[15ch]">{t('notFound.title')}</h1>
        <p className="mx-auto mt-5 max-w-[52ch] text-lg text-ink-muted">{t('notFound.body')}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to={localizedPath('/', locale)} className={buttonStyles('primary')}>{t('notFound.home')}</Link>
          <Link to={localizedPath('/guides', locale)} className={buttonStyles('ghost')}>{t('notFound.guides')}</Link>
          <Link to={localizedPath('/opportunities', locale)} className={buttonStyles('ghost')}>{t('notFound.opportunities')}</Link>
        </div>
      </div>
    </section>
  );
}
