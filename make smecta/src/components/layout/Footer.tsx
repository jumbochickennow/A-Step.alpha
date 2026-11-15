import { Instagram, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { cn } from '../../lib/utils';
import { Brand } from './Brand';

export function Footer() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const isPrices = /\/consultation\/?$/.test(pathname);
  const isResources = /\/resources\/?$/.test(pathname);
  const blue = /\/(contact|consultation|resources)\/?$/.test(pathname);
  const link = (path: string) => localizedPath(path, locale);

  return (
    <footer id="astep-footer" className={cn('relative text-white', blue ? 'bg-brand-blue-text-light' : 'bg-footer', isPrices && 'prices-footer', isResources && 'resources-footer')}>
      <div className="container-shell">

        <div className="grid gap-10 py-12 md:grid-cols-[1.5fr_0.55fr_0.45fr] md:py-14">
          <div>
            <Brand light />
            <p className="mt-5 max-w-[52ch] text-xs leading-relaxed text-white/90">{t('footer.body')}</p>
            <div className="mt-5 flex items-center gap-4 text-white" aria-label="Social media">
              <a
                href="https://www.instagram.com/astep.immigrarion?igsi=ODNrbDFydmU5Nnhm"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="relative inline-grid size-10 place-items-center rounded-full text-white/85 before:absolute before:-inset-0.5 before:content-[''] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Instagram size={15} aria-hidden="true" />
              </a>
              <a
                href="mailto:contact@astepimmigration.space"
                aria-label="Email A-Step"
                className="relative inline-grid size-10 place-items-center rounded-full text-white/85 before:absolute before:-inset-0.5 before:content-[''] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Mail size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold">{t('footer.company')}</h2>
            <div className="mt-4 flex flex-col gap-3 text-xs text-white/90">
              <Link to={link('/guides')} className="relative hover:text-white before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']">{t('nav.guides')}</Link>
              <Link to={link('/opportunities')} className="relative hover:text-white before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']">{t('nav.opportunities')}</Link>
              <Link to={link('/contact')} className="relative hover:text-white before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']">{t('nav.contact')}</Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold">{t('footer.legal')}</h2>
            <div className="mt-4 flex flex-col gap-3 text-xs text-white/90">
              <Link to={link('/terms')} className="relative hover:text-white before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']">{t('footer.terms')}</Link>
              <Link to={link('/privacy')} className="relative hover:text-white before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']">{t('footer.privacy')}</Link>
              <Link to={`${link('/privacy')}#cookies`} className="relative hover:text-white before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']">{t('footer.cookies')}</Link>
              <Link to={link('/terms')} className="relative hover:text-white before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']">{t('footer.license')}</Link>
            </div>
          </div>
        </div>
      </div>
      <div className={cn('border-t py-5 text-center text-xs text-white/85', blue ? 'border-white/20' : 'border-white/10')}>
        {t('footer.rights', { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
