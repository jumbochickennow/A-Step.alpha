import { Download, Loader2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { COUNTRIES, categoryLabel } from '../../lib/constants';
import {
  suggestEmail,
  validateGuideDownloadForm,
  type GuideDownloadFormInputs,
} from '../../lib/validation';
import { track } from '../../services/analytics';
import { submitGuideLead } from '../../services/leads.service';
import type { GuideLanguage, LocalizedGuide } from '../../types/content';
import { useToast } from '../../hooks/useToast';
import { Button } from '../common/Button';
import { TurnstileWidget, isTurnstileEnabled } from '../common/TurnstileWidget';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, useEscapeToClose } from '../ui/Dialog';

const EMPTY_FORM: GuideDownloadFormInputs = {
  fullName: '',
  email: '',
  guideLanguage: 'en',
  targetCountry: '',
};
/** Submission order used to focus the first invalid control. */
const FIELD_ORDER: (keyof GuideDownloadFormInputs)[] = [
  'fullName',
  'email',
];
const GUIDE_LANGUAGES: Array<{ value: GuideLanguage; labelKey: string }> = [
  { value: 'en', labelKey: 'guides.modal.languageEnglish' },
  { value: 'fr', labelKey: 'guides.modal.languageFrench' },
  { value: 'ar', labelKey: 'guides.modal.languageArabic' },
];
/** Minimum delay between accepted submissions (blocks rapid multi-clicks). */
const SUBMIT_COOLDOWN_MS = 5000;
/** Simulated latency for silently rejected bot submissions. */
const BOT_REJECT_DELAY_MS = 600;

/**
 * Lead capture + instant download dialog.
 *
 * Every active guide resolves to a downloadable PDF (its bundled `filePath`
 * asset, or a generated placeholder), so the form is always available — there
 * is no "guide being prepared" state. Inputs are sanitized and validated
 * through the centralized layer before any lead data is recorded.
 */
export function GuideDownloadDialog({ guide, triggerClassName }: { guide: LocalizedGuide; triggerClassName?: string }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const renderedAt = useRef(Date.now());
  const lastSubmitAt = useRef(0);
  const [values, setValues] = useState<GuideDownloadFormInputs>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof GuideDownloadFormInputs, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileEnabled = isTurnstileEnabled();
  const { toast } = useToast();
  const availableLanguages = guide.availableLanguages ?? { en: true, fr: false, ar: false };

  // DialogContent owns the body lock; Escape dismisses this controlled dialog.
  useEscapeToClose(open, () => setOpen(false));

  /** Clears errors and form state (including honeypot + Turnstile token) when the dialog closes or completes. */
  const resetForm = () => {
    setValues(EMPTY_FORM);
    setErrors({});
    setStatus('idle');
    setSuggestion(null);
    setHoneypot('');
    setTurnstileToken('');
    setTurnstileError(false);
  };

  const update =
    (field: keyof GuideDownloadFormInputs) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };

  /** Re-runs centralized validation on blur: fixed fields clear, invalid ones stay flagged. */
  const revalidateOnBlur = () => {
    setErrors(validateGuideDownloadForm(values, t).errors);
    setSuggestion(suggestEmail(values.email));
  };

  const triggerBrowserDownload = (downloadUrl: string, guideLanguage: GuideLanguage) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `${guide.slug}-${guideLanguage}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (downloadUrl.startsWith('blob:')) {
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('idle');

    // Submission cooldown: block rapid multi-clicks while processing.
    const now = Date.now();
    if (isSubmitting || now - lastSubmitAt.current < SUBMIT_COOLDOWN_MS) return;
    lastSubmitAt.current = now;

    // Honeypot trap: silently close without recording any lead or download.
    if (honeypot.trim().length > 0) {
      setIsSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, BOT_REJECT_DELAY_MS));
      setIsSubmitting(false);
      setOpen(false);
      resetForm();
      return;
    }

    const result = validateGuideDownloadForm(values, t);
    setErrors(result.errors);
    if (!result.isValid) {
      const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);
      if (firstInvalid) document.getElementById(`${firstInvalid}-${guide.id}`)?.focus();
      return;
    }

    // Require a fresh Turnstile token before accepting the lead.
    if (turnstileEnabled && !turnstileToken) {
      setTurnstileError(true);
      return;
    }
    setTurnstileError(false);

    setIsSubmitting(true);
    try {
      const downloadUrl = await submitGuideLead({
        fullName: result.data.fullName,
        email: result.data.email,
        guideId: guide.id,
        guideLanguage: result.data.guideLanguage,
        targetCountry: result.data.targetCountry,
        guideSlug: guide.slug,
        locale,
        turnstileToken,
      });
      track('guide_download_success', { guide: guide.slug });
      triggerBrowserDownload(downloadUrl, result.data.guideLanguage);
      toast.success(t('forms.downloadStarted'));
      setOpen(false);
      resetForm();
      renderedAt.current = Date.now();
    } catch {
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
          renderedAt.current = Date.now();
          track('guide_download_start', { guide: guide.slug });
        } else {
          // Reset errors and form state cleanly when the dialog is closed.
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className={triggerClassName ?? 'mt-6 w-full'}><Download size={18} aria-hidden="true" />{t('guides.download')}</Button>
      </DialogTrigger>
      <DialogContent aria-describedby="guide-dialog-description">
        <DialogTitle className="page-title pe-10">{t('guides.modal.title')}</DialogTitle>
        <DialogDescription id="guide-dialog-description" className="mt-3 leading-relaxed text-ink-muted">
          {t('guides.modal.intro', { guide: guide.title })}
        </DialogDescription>

        <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
          <div className="opacity-0 absolute -z-50 h-0 w-0 pointer-events-none select-none" aria-hidden="true">
            <label htmlFor={`hp-company-${guide.id}`}>Company</label>
            <input
              type="text"
              id={`hp-company-${guide.id}`}
              name="hp_company"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`fullName-${guide.id}`} className="mb-2 block text-sm font-semibold">{t('guides.modal.name')}</label>
            <input
              id={`fullName-${guide.id}`}
              type="text"
              className={`field ${errors.fullName ? 'border-[var(--danger)]' : ''}`}
              autoComplete="name"
              maxLength={70}
              value={values.fullName}
              onChange={update('fullName')}
              onBlur={revalidateOnBlur}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? `fullName-error-${guide.id}` : undefined}
            />
            <p id={`fullName-error-${guide.id}`} className="mt-1 min-h-4 text-xs text-red-500">{errors.fullName ?? ''}</p>
          </div>
          <div>
            <label htmlFor={`email-${guide.id}`} className="mb-2 block text-sm font-semibold">{t('guides.modal.email')}</label>
            <input
              id={`email-${guide.id}`}
              type="email"
              className={`field ${errors.email ? 'border-[var(--danger)]' : ''}`}
              autoComplete="email"
              maxLength={254}
              value={values.email}
              onChange={update('email')}
              onBlur={revalidateOnBlur}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `email-error-${guide.id}` : undefined}
            />
            <p id={`email-error-${guide.id}`} className={`mt-1 min-h-4 text-xs ${errors.email ? 'text-red-500' : 'text-brand-blue-text'}`}>{errors.email ?? (suggestion ? t('forms.didYouMean', { email: suggestion }) : '')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`guideLanguage-${guide.id}`} className="mb-2 block text-sm font-semibold">{t('guides.modal.guideLanguage')}</label>
              <select
                id={`guideLanguage-${guide.id}`}
                className="field"
                value={values.guideLanguage}
                onChange={update('guideLanguage')}
                required
              >
                {GUIDE_LANGUAGES.map(({ value, labelKey }) => (
                  <option key={value} value={value} disabled={!availableLanguages[value]}>
                    {t(labelKey)}{availableLanguages[value] ? '' : ` (${t('guides.modal.unavailable')})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`targetCountry-${guide.id}`} className="mb-2 block text-sm font-semibold">{t('guides.modal.country')}</label>
              <select
                id={`targetCountry-${guide.id}`}
                className="field"
                value={values.targetCountry ?? ''}
                onChange={update('targetCountry')}
                onBlur={revalidateOnBlur}
                aria-invalid={Boolean(errors.targetCountry)}
                aria-describedby={errors.targetCountry ? `targetCountry-error-${guide.id}` : undefined}
              >
                <option value="">—</option>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>{categoryLabel(country, t)}</option>
                ))}
              </select>
              <p id={`targetCountry-error-${guide.id}`} className="mt-1 min-h-4 text-xs text-red-500">{errors.targetCountry ?? ''}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ink-muted">
            {t('guides.modal.privacy')}{' '}
            <Link className="text-brand-blue-text underline" to={localizedPath('/privacy', locale)}>{t('guides.modal.privacyLink')}</Link>
          </p>
          <div className="min-h-[3.25rem]">
            {status === 'error' ? <p role="alert" className="rounded-md border border-[rgb(248_113_113/0.3)] bg-[rgb(248_113_113/0.08)] p-3 text-sm text-[var(--danger)]">{navigator.onLine ? t('guides.modal.error') : t('common.offline')}</p> : null}
          </div>
          {turnstileEnabled ? (
            <div>
              <TurnstileWidget
                action="lead_download"
                onVerify={(token) => {
                  setTurnstileToken(token);
                  setTurnstileError(false);
                }}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
                size="compact"
              />
              <p className="mt-1 min-h-4 text-xs text-red-500">{turnstileError ? t('forms.turnstileRequired') : ''}</p>
            </div>
          ) : null}
          <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white shadow-md transition hover:bg-blue-700">
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                {t('guides.modal.submitting')}
              </>
            ) : (
              <>
                <Download size={18} aria-hidden="true" />
                {t('guides.modal.submit')}
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
