import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { cn } from '../../lib/utils';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger, useEscapeToClose } from '../ui/Dialog';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';

const links = [
  ['nav.opportunities', '/opportunities'],
  ['nav.guides', '/guides'],
  ['nav.about', '/about'],
  ['nav.contact', '/contact'],
] as const;

function DesktopLinks({ light }: { light: boolean }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-10 lg:flex">
      {links.map(([key, path]) => (
        <NavLink
          key={path}
          to={localizedPath(path, locale)}
          className={({ isActive }: { isActive: boolean }) => cn(
            'relative py-3 text-[0.8rem] font-bold after:absolute after:inset-x-0 after:bottom-1 after:h-0.5 after:origin-center after:scale-x-0 after:bg-brand-coral after:transition-transform hover:after:scale-x-100 focus-visible:after:scale-x-100 hover:opacity-80',
            light ? 'text-brand-blue' : 'text-white',
            isActive && 'after:scale-x-100',
          )}
        >
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}

function MobileMenu({ light }: { light: boolean }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Explicit Escape dismissal (complements Radix's built-in handling).
  useEscapeToClose(open, () => setOpen(false));
  // Release the lock whenever a route navigation happens.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn('grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border lg:hidden', light ? 'border-brand-blue/30 text-brand-blue' : 'border-white/20 text-white')}
          aria-label={t('nav.menuOpen')}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </DialogTrigger>
      {/* Drawer slides from the logical end; the Radix overlay behind it dismisses on tap-outside. */}
      <DialogContent className="start-auto end-0 top-0 h-dvh max-h-none w-[min(88vw,360px)] max-w-none translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-none border-y-0 border-e-0 p-6 rtl:translate-x-0">
        <DialogTitle className="sr-only">{t('nav.menuOpen')}</DialogTitle>
        <nav className="mt-14 flex flex-col" aria-label="Mobile">
          {links.map(([key, path]) => (
            <DialogClose asChild key={path}>
              <NavLink to={localizedPath(path, locale)} className={({ isActive }: { isActive: boolean }) => cn('flex min-h-11 items-center border-b border-border px-4 py-3 text-lg font-semibold text-ink-muted', isActive && 'text-brand-coral')}>
                {t(key)}
              </NavLink>
            </DialogClose>
          ))}
        </nav>
        {/* Generous, one-handed language switching inside the drawer. */}
        <div className="mt-10 flex min-h-11 items-center">
          <LanguageSwitcher />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Navbar() {
  const { pathname } = useLocation();
  const isContact = /\/contact\/?$/.test(pathname);
  const isHome = pathname === '/' || pathname === '/fr/' || pathname === '/fr' || pathname === '/ar/' || pathname === '/ar';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b transition-colors duration-200 ease-out',
        scrolled ? 'border-border bg-bg/85 backdrop-blur' : 'border-transparent bg-transparent',
      )}
    >
      <div className="container-shell grid min-h-24 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 xs:gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Brand light={!isContact && !isHome} />
        <DesktopLinks light={isContact} />
        <div className="flex min-w-0 items-center justify-end gap-1 xs:gap-2">
          <LanguageSwitcher light={isContact} />
          <MobileMenu light={isContact} />
        </div>
      </div>
    </header>
  );
}
