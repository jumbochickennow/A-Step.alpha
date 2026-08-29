import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { useLocale } from '../../hooks/useLocale';
import { PageLoadingFallback } from '../common/States';
import { Footer } from './Footer';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { Navbar } from './Navbar';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [pathname]);
  return null;
}

export function SiteLayout() {
  const { t } = useTranslation();
  useLocale();
  return (
    <>
      <a href="#main-content" className="fixed start-4 top-3 z-[100] -translate-y-20 rounded-md bg-white px-4 py-3 font-semibold text-bg transition-transform focus:translate-y-0">
        {t('common.skip')}
      </a>
      <ScrollToTop />
      <Navbar />
      <main id="main-content">
        <Suspense fallback={<PageLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <FloatingWhatsApp />
      <Footer />
    </>
  );
}
