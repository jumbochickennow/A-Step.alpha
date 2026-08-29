import { zodResolver } from '@hookform/resolvers/zod';
import { Instagram, Mail } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { useToast } from '../../hooks/useToast';
import { newsletterSchema } from '../../lib/validation';
import { cn } from '../../lib/utils';
import { track } from '../../services/analytics';
import { subscribeNewsletter } from '../../services/email.service';
import { TurnstileWidget, isTurnstileEnabled } from '../common/TurnstileWidget';
import { Brand } from './Brand';

interface NewsletterValues { email: string; consent: true | false }

function NewsletterForm({ blue }: { blue: boolean }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const honeypot = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileEnabled = isTurnstileEnabled();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '', consent: true },
  });

  const submit = handleSubmit(async (values) => {
    setStatus('idle');
    if (honeypot.current?.value) return;
    if (turnstileEnabled && !turnstileToken) {
      setTurnstileError(true);
      return;
    }
    try {
      await subscribeNewsletter({ email: values.email, locale, turnstileToken });
      track('newsletter_subscribe');
      setStatus('success');
      toast.success(t('forms.newsletterSuccess'));
      reset({ email: '', consent: true });
      setTurnstileToken('');
    } catch {
      setStatus('error');
    }
  });

  return (
    <form onSubmit={submit} noValidate className="relative min-w-0" aria-label={t('footer.newsletterTitle')}>
      <div className="absolute start-[-9999px]" aria-hidden="true"><label htmlFor="newsletter-website">Website</label><input ref={honeypot} id="newsletter-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <input type="checkbox" defaultChecked className="sr-only" tabIndex={-1} aria-hidden="true" {...register('consent')} />
      <label htmlFor="newsletter-email" className="sr-only">{t('footer.email')}</label>
      <div className="grid min-w-0 gap-2 rounded-2xl bg-white p-1 shadow-sm sm:flex sm:h-12 sm:items-center sm:gap-0 sm:rounded-full">
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder={t('footer.email')}
          aria-invalid={Boolean(errors.email)}
          className="h-11 w-full min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:h-full sm:px-5 sm:rounded-e-none sm:rounded-s-full"
          {...register('email')}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-11 w-full shrink-0 whitespace-normal rounded-xl bg-blue-600 px-5 py-2 text-xs font-medium leading-snug text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 sm:min-h-10 sm:w-auto sm:rounded-s-none sm:rounded-e-full sm:px-7 motion-reduce:hover:transform-none"
        >
          {isSubmitting ? t('footer.subscribing') : blue ? t('footer.subscribe') : t('footer.receive')}
        </button>
      </div>
      <p className="mt-2 min-h-4 text-xs text-red-200">{errors.email ? t('forms.emailInvalid') : ''}</p>
      {turnstileEnabled ? (
        <div className="mt-3">
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
          <p className="mt-2 min-h-4 text-xs text-red-200">{turnstileError ? t('forms.turnstileRequired') : ''}</p>
        </div>
      ) : null}
      <div className="mt-2 min-h-4">
        {status === 'success' ? <p className="text-xs text-emerald-200" role="status">{t('footer.success')}</p> : null}
        {status === 'error' ? <p className="text-xs text-red-200" role="alert">{navigator.onLine ? t('footer.error') : t('common.offline')}</p> : null}
      </div>
    </form>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { pathname } = useLocation();
  const blue = /\/contact\/?$/.test(pathname);
  const link = (path: string) => localizedPath(path, locale);

  return (
    <footer id="astep-footer" className={cn('relative pt-10 text-white', blue ? 'bg-brand-blue' : 'bg-[#111722]')}>
      <div className="container-shell">
        <div className={cn('grid min-w-0 items-center gap-6 rounded-2xl px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:px-8', blue ? 'bg-[#3cb0ec]' : 'bg-[#8d9188]')}>
          <div className="min-w-0">
            <h2 className="text-base font-bold md:text-lg">{t('footer.newsletterTitle')}</h2>
            <p className="mt-1 max-w-[58ch] text-xs leading-relaxed text-white/80">{t('footer.newsletterBody')}</p>
          </div>
          <NewsletterForm blue={blue} />
        </div>

        <div className="grid gap-10 py-8 md:grid-cols-[1.5fr_0.55fr_0.45fr] md:py-10">
          <div>
            <Brand light />
            <p className="mt-5 max-w-[52ch] text-xs leading-relaxed text-white/75">{t('footer.body')}</p>
            <div className="mt-5 flex items-center gap-4 text-white" aria-label="Social media">
              <Instagram size={15} aria-hidden="true" />
              <Mail size={15} aria-hidden="true" />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold">{t('footer.company')}</h2>
            <div className="mt-4 flex flex-col gap-3 text-xs text-white/75">
              <Link to={link('/about')} className="hover:text-white">{t('nav.about')}</Link>
              <Link to={link('/guides')} className="hover:text-white">{t('nav.guides')}</Link>
              <Link to={link('/opportunities')} className="hover:text-white">{t('nav.opportunities')}</Link>
              <Link to={link('/contact')} className="hover:text-white">{t('nav.contact')}</Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold">{t('footer.legal')}</h2>
            <div className="mt-4 flex flex-col gap-3 text-xs text-white/75">
              <Link to={link('/terms')} className="hover:text-white">{t('footer.terms')}</Link>
              <Link to={link('/privacy')} className="hover:text-white">{t('footer.privacy')}</Link>
              <Link to={`${link('/privacy')}#cookies`} className="hover:text-white">{t('footer.cookies')}</Link>
              <Link to={link('/terms')} className="hover:text-white">{t('footer.license')}</Link>
            </div>
          </div>
        </div>
      </div>
      <div className={cn('border-t py-5 text-center text-xs text-white/65', blue ? 'border-white/20' : 'border-white/10')}>
        {t('footer.rights', { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
