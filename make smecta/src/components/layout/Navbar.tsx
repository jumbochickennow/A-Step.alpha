import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { cn } from '../../lib/utils';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger, useEscapeToClose } from '../ui/Dialog';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';
import '../../styles/navbar.css';

const links = [
  ['nav.opportunities', '/opportunities'],
  ['nav.guides', '/guides'],
  ['nav.about', '/about'],
  ['nav.contact', '/contact'],
  ['nav.resources', '/resources'],
  ['nav.prices', '/prices'],
] as const;

function DesktopLinks() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-6 xl:gap-10 lg:flex">
      {links.map(([key, path]) => (
        <NavLink
          key={path}
          to={localizedPath(path, locale)}
          className={({ isActive }: { isActive: boolean }) => cn(
            'navbar-link relative py-3 text-sm font-bold after:absolute after:inset-x-0 after:bottom-1 after:h-0.5 after:origin-center after:scale-x-0 after:bg-brand-coral after:transition-transform hover:after:scale-x-100 focus-visible:after:scale-x-100',
            isActive && 'after:scale-x-100',
          )}
        >
          {path === '/guides' ? ({ en: 'Guides', fr: 'Guides', ar: 'الأدلة' }[locale]) : t(key)}
        </NavLink>
      ))}
    </nav>
  );
}

function MobileMenu() {
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
          className="navbar-menu-trigger grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border border-brand-blue/30 text-brand-blue lg:hidden"
          aria-label={t('nav.menuOpen')}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </DialogTrigger>
      {/* Drawer slides from the logical end; the Radix overlay behind it dismisses on tap-outside. */}
      <DialogContent className="navbar-drawer start-auto end-0 top-0 h-dvh max-h-none w-[min(88vw,360px)] max-w-none translate-x-0 translate-y-0 overflow-y-auto overscroll-contain rounded-none border-y-0 border-e-0 p-6 rtl:translate-x-0">
        <DialogTitle className="sr-only">{t('nav.menuOpen')}</DialogTitle>
        <nav className="mt-14 flex flex-col" aria-label="Mobile">
          {links.map(([key, path]) => (
            <DialogClose asChild key={path}>
              <NavLink to={localizedPath(path, locale)} className="navbar-link flex min-h-11 items-center border-b border-brand-blue/10 px-4 py-3 text-lg font-semibold">
                {path === '/guides' ? ({ en: 'Guides', fr: 'Guides', ar: 'الأدلة' }[locale]) : t(key)}
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
  return (
    <header className="astep-navbar fixed inset-x-0 top-0 z-40">
      <div className="navbar-inner grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 xs:gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Brand />
        <DesktopLinks />
        <div className="flex min-w-0 items-center justify-end gap-1 xs:gap-2">
          <LanguageSwitcher />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
