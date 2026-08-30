import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/common/Button';
import { Seo } from '../components/common/Seo';
import { TurnstileWidget, isTurnstileEnabled } from '../components/common/TurnstileWidget';
import { useLocale } from '../hooks/useLocale';
import { useToast } from '../hooks/useToast';
import { categoryLabel, TOPICS } from '../lib/constants';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
  suggestEmail,
  validateContactForm,
  type ContactFormInputs,
} from '../lib/validation';
import { track } from '../services/analytics';
import { sendContactMessage } from '../services/email.service';

const EMPTY_FORM: ContactFormInputs = { fullName: '', email: '', phone: '', serviceInterest: '', message: '' };
/** Submission order used to focus the first invalid control. */
const FIELD_ORDER: (keyof ContactFormInputs)[] = ['fullName', 'email', 'phone', 'serviceInterest', 'message'];
/** Minimum delay between accepted submissions (blocks rapid multi-clicks). */
const SUBMIT_COOLDOWN_MS = 5000;
/** Simulated latency for silently rejected bot submissions. */
const BOT_REJECT_DELAY_MS = 800;

export function Contact() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const renderedAt = useRef(Date.now());
  const lastSubmitAt = useRef(0);
  const { toast } = useToast();
  const [values, setValues] = useState<ContactFormInputs>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormInputs, string>>>({});
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [challengeVersion, setChallengeVersion] = useState(0);
  const turnstileEnabled = isTurnstileEnabled();

  const update =
    (field: keyof ContactFormInputs) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };

  /** Sanitized snapshot of the current inputs, per the centralized rules. */
  const sanitizedInputs = (): ContactFormInputs => ({
    fullName: values.fullName,
    email: sanitizeEmail(values.email),
    phone: sanitizePhone(values.phone),
    serviceInterest: values.serviceInterest,
    message: sanitizeText(values.message, 2000),
  });

  /** Re-runs the centralized validator on blur: fixed fields clear their error, still-invalid ones stay flagged. */
  const revalidateOnBlur = () => {
    setErrors(validateContactForm(sanitizedInputs(), t).errors);
    setSuggestion(suggestEmail(values.email));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('idle');

    // Submission cooldown: block rapid multi-clicks and re-entries while a
    // previous submission is still processing.
    const now = Date.now();
    if (isSubmitting || now - lastSubmitAt.current < SUBMIT_COOLDOWN_MS) return;
    lastSubmitAt.current = now;

    // Honeypot trap: a filled invisible field means an automated client.
    // Simulate a delayed success without dispatching anything (silent rejection).
    if (honeypot.trim().length > 0) {
      setIsSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, BOT_REJECT_DELAY_MS));
      setStatus('success');
      setValues(EMPTY_FORM);
      setIsSubmitting(false);
      return;
    }

    // Sanitize all input values before validation; `result.data` carries the
    // sanitized payload that gets dispatched.
    const result = validateContactForm(sanitizedInputs(), t);
    setErrors(result.errors);
    if (!result.isValid) {
      const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);
      if (firstInvalid) document.getElementById(`contact-${firstInvalid}`)?.focus();
      return;
    }

    // Require a fresh Turnstile token before accepting the submission.
    if (turnstileEnabled && !turnstileToken) {
      setTurnstileError(true);
      return;
    }
    setTurnstileError(false);

    setIsSubmitting(true);
    try {
      await sendContactMessage({
        name: result.data.fullName,
        email: result.data.email,
        phone: result.data.phone,
        serviceInterest: result.data.serviceInterest,
        message: result.data.message,
        locale,
        turnstileToken,
      });
      track('contact_submit');
      setStatus('success');
      toast.success(t('forms.contactSuccess'));
      setValues(EMPTY_FORM);
      setHoneypot('');
      renderedAt.current = Date.now();
    } catch {
      setStatus('error');
    } finally {
      setTurnstileToken('');
      if (turnstileEnabled) setChallengeVersion((version) => version + 1);
      setIsSubmitting(false);
    }
  };

  const inputClass = (field: keyof ContactFormInputs) => {
    const hasError = Boolean(errors[field]);
    return `h-12 w-full rounded-md border bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 ${
      hasError ? 'border-red-400 focus:border-red-500' : 'border-slate-200'
    }`;
  };

  const describedBy = (field: keyof ContactFormInputs) =>
    errors[field] || (field === 'email' && suggestion) ? `contact-${field}-error` : undefined;

  const errorText = (field: keyof ContactFormInputs) => {
    const error = errors[field];
    const message = error ?? (field === 'email' && suggestion ? t('forms.didYouMean', { email: suggestion }) : '');
    return <p id={`contact-${field}-error`} className={`mt-1 min-h-4 text-xs ${error ? 'text-red-500' : 'text-brand-blue'}`}>{message}</p>;
  };

  return (
    <>
      <Seo title={t('contact.metaTitle')} description={t('contact.metaDescription')} />
      <section className="min-h-[1120px] bg-white px-5 pb-40 pt-52 text-slate-950 md:min-h-[1320px] md:pt-64 lg:min-h-[1500px]">
        <div className="mx-auto text-center">
          <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl">{t('contact.title')}</h1>
          <p className="mx-auto mt-5 max-w-4xl text-sm leading-relaxed text-slate-600">{t('contact.body')}</p>
        </div>

        <div className="relative mx-auto mt-8 max-w-[640px]">
          <form onSubmit={submit} noValidate className="relative z-10 rounded-lg bg-[#f7f7f7] p-6 shadow-[0_16px_36px_rgb(15_23_42/0.1)] md:p-9">
            <div className="opacity-0 absolute -z-50 h-0 w-0 pointer-events-none select-none" aria-hidden="true">
              <label htmlFor="contact-hp-company">Company</label>
              <input
                type="text"
                id="contact-hp-company"
                name="hp_company"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
              />
            </div>
            <div className="space-y-5">
              <div>
                <label htmlFor="contact-fullName" className="mb-2 block text-xs font-bold text-slate-900">{t('contact.name')}</label>
                <input
                  id="contact-fullName"
                  type="text"
                  placeholder={t('contact.namePlaceholder')}
                  className={inputClass('fullName')}
                  autoComplete="name"
                  maxLength={70}
                  value={values.fullName}
                  onChange={update('fullName')}
                  onBlur={revalidateOnBlur}
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={describedBy('fullName')}
                />
                {errorText('fullName')}
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-2 block text-xs font-bold text-slate-900">{t('contact.email')}</label>
                <input
                  id="contact-email"
                  type="email"
                  dir={isArabic ? 'ltr' : undefined}
                  placeholder={t('contact.emailPlaceholder')}
                  className={`${inputClass('email')} text-start`}
                  autoComplete="email"
                  maxLength={254}
                  value={values.email}
                  onChange={update('email')}
                  onBlur={revalidateOnBlur}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={describedBy('email')}
                />
                {errorText('email')}
              </div>
              <div>
                <label htmlFor="contact-phone" className="mb-2 block text-xs font-bold text-slate-900">{t('contact.phone')}</label>
                <input
                  id="contact-phone"
                  type="tel"
                  dir={isArabic ? 'ltr' : undefined}
                  placeholder={t('contact.phonePlaceholder')}
                  className={`${inputClass('phone')} text-start`}
                  autoComplete="tel"
                  maxLength={20}
                  value={values.phone}
                  onChange={update('phone')}
                  onBlur={revalidateOnBlur}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={describedBy('phone')}
                />
                {errorText('phone')}
              </div>
              <div>
                <label htmlFor="contact-serviceInterest" className="mb-2 block text-xs font-bold text-slate-900">{t('contact.serviceInterest')}</label>
                <select
                  id="contact-serviceInterest"
                  className={`${inputClass('serviceInterest')} ${values.serviceInterest ? '' : 'text-slate-400'}`}
                  value={values.serviceInterest ?? ''}
                  onChange={update('serviceInterest')}
                  onBlur={revalidateOnBlur}
                  aria-invalid={Boolean(errors.serviceInterest)}
                  aria-describedby={describedBy('serviceInterest')}
                >
                  <option value="">{t('contact.serviceInterest')}</option>
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>{categoryLabel(topic, t)}</option>
                  ))}
                  <option value="Other">{t('forms.other')}</option>
                </select>
                {errorText('serviceInterest')}
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-2 block text-xs font-bold text-slate-900">{t('contact.message')}</label>
                <textarea
                  id="contact-message"
                  rows={4}
                  placeholder={t('contact.messagePlaceholder')}
                  className={`w-full resize-y rounded-md border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 ${errors.message ? 'border-red-400 focus:border-red-500' : 'border-slate-200'}`}
                  maxLength={2000}
                  value={values.message}
                  onChange={update('message')}
                  onBlur={revalidateOnBlur}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={describedBy('message')}
                />
                {errorText('message')}
              </div>
            </div>
            <p className="mt-8 text-center text-sm text-slate-600">{t('contact.responseOneHour')}</p>
            <div className="mt-4 min-h-[3.25rem]">
              {status === 'success' ? <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{t('contact.success')}</p> : null}
              {status === 'error' ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{navigator.onLine ? t('contact.error') : t('common.offline')}</p> : null}
            </div>
            {turnstileEnabled ? (
              <div className="mt-5">
                <TurnstileWidget
                  key={challengeVersion}
                  action="contact"
                  onVerify={(token) => {
                    setTurnstileToken(token);
                    setTurnstileError(false);
                  }}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => {
                    setTurnstileToken('');
                    setTurnstileError(true);
                  }}
                />
                <p className="mt-1 min-h-4 text-xs text-red-500">{turnstileError ? t('forms.turnstileRequired') : ''}</p>
              </div>
            ) : null}
            <Button type="submit" disabled={isSubmitting} className="mt-8 w-full">{isSubmitting ? t('contact.sending') : t('contact.send')}</Button>
          </form>
          <div className="pointer-events-none relative z-0 flex min-w-0 justify-center">
            <img
              src="/assets/contact/bluephone-speaker.png"
              width="736"
              height="946"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="relative mx-auto -mt-2 h-auto w-[min(72vw,320px)] object-contain sm:w-[min(55vw,380px)] md:w-[min(42vw,460px)] lg:-mt-6 lg:w-[min(34vw,520px)] xl:-mt-10 xl:w-[min(30vw,560px)]"
            />
          </div>
        </div>
      </section>
    </>
  );
}
