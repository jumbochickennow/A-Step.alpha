import { Instagram, Mail } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { track } from '../../services/analytics';
import { subscribeNewsletter } from '../../services/email.service';
import { TurnstileWidget, isTurnstileEnabled, turnstileReservedClass } from '../common/TurnstileWidget';
import { Brand } from './Brand';

function NewsletterForm({ blue }: { blue: boolean }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const honeypot = useRef<HTMLInputElement>(null);
  const turnstileErrorRef = useRef<HTMLParagraphElement>(null);
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  // Turnstile (≈1.7 MB of third-party script) mounts only once the visitor touches the email field.
  const [engaged, setEngaged] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileEnabled = isTurnstileEnabled();
  const engage = () => setEngaged(true);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setStatus('idle');
    if (honeypot.current?.value) return;
    // zod + the shared schema load on demand so the footer keeps them out of the main bundle.
    const { newsletterSchema } = await import('../../lib/validation');
    const parsed = newsletterSchema.safeParse({ email, consent: true });
    setEmailError(!parsed.success);
    if (!parsed.success) return;
    if (turnstileEnabled && !turnstileToken) {
      setEngaged(true);
      setTurnstileError(true);
      requestAnimationFrame(() => turnstileErrorRef.current?.focus());
      return;
    }
    setIsSubmitting(true);
    try {
      await subscribeNewsletter({ email: parsed.data.email, locale, turnstileToken });
      track('newsletter_subscribe');
      setStatus('success');
      toast.success(t('forms.newsletterSuccess'));
      setEmail('');
      setTurnstileToken('');
    } catch {
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="relative min-w-0" aria-label={t('footer.newsletterTitle')}>
      <div className="absolute start-[-9999px]" aria-hidden="true"><label htmlFor="newsletter-website">Website</label><input ref={honeypot} id="newsletter-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <label htmlFor="newsletter-email" className="sr-only">{t('footer.email')}</label>
      <div className="grid min-w-0 gap-2 rounded-2xl bg-white p-1 shadow-sm sm:flex sm:min-h-12 sm:items-stretch sm:gap-0 sm:rounded-full">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t('footer.email')}
          value={email}
          onChange={(event) => { setEmail(event.target.value); engage(); }}
          onFocus={engage}
          aria-invalid={emailError}
          aria-describedby={emailError ? 'newsletter-email-error' : undefined}
          className="h-11 w-full min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-800 placeholder:text-slate-500 sm:h-auto sm:px-5 sm:rounded-s-full"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full shrink-0 whitespace-nowrap rounded-xl bg-brand-blue-text-light px-5 py-2 text-xs font-medium leading-snug text-white shadow-md transition-[transform,background-color] duration-base hover:-translate-y-0.5 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-60 sm:min-h-0 sm:w-auto sm:self-stretch sm:rounded-full sm:px-7 motion-reduce:hover:transform-none"
        >
          {isSubmitting ? t('footer.subscribing') : blue ? t('footer.subscribe') : t('footer.receive')}
        </button>
      </div>
      <p id="newsletter-email-error" className="mt-2 min-h-4 text-xs text-red-100">{emailError ? t('forms.emailInvalid') : ''}</p>
      {turnstileEnabled ? (
        <div className="mt-3">
          {/* Final widget height is reserved before the script loads: no layout shift when it mounts. */}
          <div className={turnstileReservedClass('flexible')}>
            {engaged ? (
              <TurnstileWidget
                action="newsletter"
                theme="dark"
                size="flexible"
                onVerify={(token) => {
                  setTurnstileToken(token);
                  setTurnstileError(false);
                }}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
              />
            ) : null}
          </div>
          <p ref={turnstileErrorRef} tabIndex={-1} role={turnstileError ? 'alert' : undefined} className="mt-2 min-h-4 text-xs text-red-100 focus-visible:outline-none">{turnstileError ? t('forms.turnstileRequired') : ''}</p>
        </div>
      ) : null}
      <div className="mt-2 min-h-4">
        {status === 'success' ? <p className="form-success-enter text-xs text-emerald-100" role="status">{t('footer.success')}</p> : null}
        {status === 'error' ? <p className="text-xs text-red-100" role="alert">{navigator.onLine ? t('footer.error') : t('common.offline')}</p> : null}
      </div>
    </form>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const isPrices = /\/consultation\/?$/.test(pathname);
  const isResources = /\/resources\/?$/.test(pathname);
  const blue = /\/(contact|consultation|resources)\/?$/.test(pathname);
  const link = (path: string) => localizedPath(path, locale);

  return (
    <footer id="astep-footer" className={cn('relative pt-10 text-white', blue ? 'bg-brand-blue-text-light' : 'bg-footer', isPrices && 'prices-footer', isResources && 'resources-footer')}>
      <div className="container-shell">
        <div className={cn('grid min-w-0 items-center gap-6 rounded-2xl px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:px-8', blue ? 'bg-footer-card-blue' : 'bg-footer-card')}>
          <div className="min-w-0">
            <h2 className="text-base font-bold md:text-lg">{t('footer.newsletterTitle')}</h2>
            <p className="mt-1 max-w-[58ch] text-xs leading-relaxed text-white/90">{t('footer.newsletterBody')}</p>
          </div>
          <NewsletterForm blue={blue} />
        </div>

        <div className="grid gap-10 py-8 md:grid-cols-[1.5fr_0.55fr_0.45fr] md:py-10">
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
