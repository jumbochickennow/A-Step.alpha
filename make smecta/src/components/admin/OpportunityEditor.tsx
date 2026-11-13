import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../hooks/useToast';
import {
  createAdminOpportunityDraft,
  saveAdminOpportunity,
  uploadAdminOpportunityImage,
} from '../../services/admin.service';
import { ApiError } from '../../services/api-client';
import type { Locale, Opportunity } from '../../types/content';
import { Button } from '../common/Button';
import { TranslationFields } from './TranslationFields';
import { resourceExpiry } from '../../lib/resource-expiry';

const emptyTranslations = { en: { title: '', description: '' }, fr: { title: '', description: '' }, ar: { title: '', description: '' } };
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp']);
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const LOCALES: Locale[] = ['en', 'fr', 'ar'];

type EditorValue = Omit<Opportunity, 'id'> & { id?: string };

export function OpportunityEditor({ opportunity, onCancel, onSaved, resourceMode = false }: { opportunity?: Opportunity; onCancel: () => void; onSaved: () => void; resourceMode?: boolean }) {
  const collection = resourceMode ? 'resources' : 'opportunities';
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Locale>('en');
  const [categories, setCategories] = useState(opportunity?.categories.join(', ') ?? (resourceMode ? 'Resources' : 'Scholarships'));
  const [value, setValue] = useState<EditorValue>({
    id: opportunity?.id, slug: opportunity?.slug ?? '', country: opportunity?.country ?? (resourceMode ? 'Resource' : 'France'), categories: opportunity?.categories ?? [resourceMode ? 'Resources' : 'Scholarships'], imagePath: opportunity?.imagePath ?? null,
    applyUrl: opportunity?.applyUrl ?? '', opensAt: opportunity?.opensAt ?? '', deadline: opportunity?.deadline ?? '', featured: opportunity?.featured ?? false, published: opportunity?.published ?? false,
    translations: opportunity?.translations ?? emptyTranslations,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!image) { setPreviewUrl(null); return undefined; }
    const nextPreview = URL.createObjectURL(image);
    setPreviewUrl(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [image]);

  const messageFor = (cause: unknown) => {
    if (!(cause instanceof ApiError)) return t('admin.loadError');
    if (cause.code === 'translation_required') return t('admin.translationRequired');
    if (cause.code === 'invalid_opportunity_url') return t('admin.invalidApplyUrl');
    if (cause.code === 'invalid_opportunity_details') return t('admin.invalidOpportunityDetails');
    return cause.message;
  };

  const normalizedValue = (): EditorValue => ({
    ...value,
    slug: value.slug.trim(),
    country: value.country.trim(),
    categories: categories.split(',').map((item) => item.trim()).filter(Boolean),
    applyUrl: value.applyUrl?.trim() || null,
    opensAt: value.opensAt || null,
    deadline: value.deadline || null,
  });

  const validateDetails = (next: EditorValue): string | null => {
    if (resourceMode && (!resourceExpiry(next.deadline) || !next.applyUrl)) return 'Set a valid expiry date and HTTPS registration link.';
    if (!SLUG_PATTERN.test(next.slug) || !next.country || next.categories.length === 0) {
      return t('admin.invalidOpportunityDetails');
    }
    if (next.applyUrl) {
      try {
        if (new URL(next.applyUrl).protocol !== 'https:') return t('admin.invalidApplyUrl');
      } catch {
        return t('admin.invalidApplyUrl');
      }
    }
    return null;
  };

  const selectImage = (file?: File) => {
    setUploadedName(null);
    if (file && (!IMAGE_TYPES.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES)) {
      setImage(null);
      setError(t('admin.invalidImage'));
      return;
    }
    setImage(file ?? null);
    setError(null);
  };

  const uploadImage = async () => {
    if (!image || uploading || saving) return;
    const next = normalizedValue();
    const validationError = validateDetails(next);
    if (validationError) { setError(validationError); return; }

    const selectedImage = image;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const resourceId = await createAdminOpportunityDraft(next, collection);
      setValue((current) => ({ ...current, id: resourceId }));
      const imagePath = await uploadAdminOpportunityImage(resourceId, selectedImage, setUploadProgress, collection);
      setValue((current) => ({ ...current, id: resourceId, imagePath }));
      setUploadedName(selectedImage.name);
      setImage(null);
      if (fileInput.current) fileInput.current.value = '';
      toast.success(t('admin.imageUploaded'));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (uploading || image) { setError(t('admin.uploadImageFirst')); return; }
    const next = normalizedValue();
    const validationError = validateDetails(next);
    if (validationError) { setError(validationError); return; }
    const missingLocale = LOCALES.find((locale) => !next.translations[locale].title.trim() || !next.translations[locale].description.trim());
    if (missingLocale) { setActive(missingLocale); setError(t('admin.translationRequired')); return; }

    setSaving(true);
    setError(null);
    try {
      await saveAdminOpportunity(next, collection);
      toast.success(t('admin.saved'));
      onSaved();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold">{t('admin.slug')}<input className="field mt-2" value={value.slug} onChange={(event) => setValue({ ...value, slug: event.target.value })} pattern="[a-z0-9-]+" required /></label>
        {!resourceMode && <><label className="text-sm font-semibold">{t('admin.country')}<input className="field mt-2" value={value.country} onChange={(event) => setValue({ ...value, country: event.target.value })} required /></label>
        <label className="text-sm font-semibold md:col-span-2">{t('admin.categories')}<input className="field mt-2" value={categories} onChange={(event) => setCategories(event.target.value)} required /></label>
        <label className="text-sm font-semibold">{t('admin.opensAt')}<input type="date" className="field mt-2" value={value.opensAt ?? ''} onChange={(event) => setValue({ ...value, opensAt: event.target.value })} /></label></>}
        <label className="text-sm font-semibold">{resourceMode ? 'Expiry date (end of day, Algeria time)' : t('admin.deadline')}<input type="date" required={resourceMode} className="field mt-2" value={value.deadline ?? ''} onChange={(event) => setValue({ ...value, deadline: event.target.value })} /></label>
        <label className="text-sm font-semibold md:col-span-2">{t('admin.applyUrl')}<input type="url" className="field mt-2" value={value.applyUrl ?? ''} onChange={(event) => setValue({ ...value, applyUrl: event.target.value })} /></label>
        <div className="text-sm font-semibold md:col-span-2">
          <span>{t('admin.image')}</span>
          <div className="mt-2 flex flex-col items-stretch gap-3 sm:flex-row">
            <input
              ref={fileInput}
              type="file"
              accept="image/avif,image/jpeg,image/png,image/webp,.avif,.jpg,.jpeg,.png,.webp"
              className="block min-w-0 flex-1 text-sm text-ink-muted file:me-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
              disabled={saving || uploading}
              onChange={(event) => selectImage(event.target.files?.[0])}
            />
            <Button type="button" className="shrink-0" disabled={!image || saving || uploading} onClick={() => void uploadImage()}>
              {uploading ? t('admin.uploadingImage') : value.imagePath ? t('admin.replaceImage') : t('admin.uploadImage')}
            </Button>
          </div>
          <span className="mt-2 block text-xs font-normal text-ink-muted">
            {image ? t('admin.selectedImage', { name: image.name }) : t('admin.imageUploadHelp')}
          </span>
          {image ? <span className="mt-1 block text-xs font-semibold text-brand-coral">{t('admin.uploadImageFirst')}</span> : null}
          {uploadProgress !== null ? (
            <progress className="mt-2 w-full" max="100" value={uploadProgress} aria-label={`${uploadProgress}%`} />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-2" aria-live="polite">
          {previewUrl && image ? <img src={previewUrl} alt={image.name} width={96} height={64} className="h-16 w-24 rounded-lg object-cover" /> : null}
          {!image && value.imagePath ? <img src={value.imagePath} alt="" width={96} height={64} className="h-16 w-24 rounded-lg object-cover" /> : null}
          {value.imagePath ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(52_211_153/0.35)] bg-[rgb(52_211_153/0.12)] px-3 py-1 font-semibold text-[var(--success)]">
              {t('admin.imageUploaded')}{uploadedName ? `: ${uploadedName}` : ''}
            </span>
          ) : !image ? <span className="text-ink-muted">{t('admin.imageNotUploaded')}</span> : null}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-6">
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={value.published} onChange={(event) => setValue({ ...value, published: event.target.checked })} className="size-4 accent-[var(--blue)]" />{t('admin.published')}</label>
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={value.featured} onChange={(event) => setValue({ ...value, featured: event.target.checked })} className="size-4 accent-[var(--blue)]" />{t('admin.featured')}</label>
      </div>
      <div className="mt-6"><TranslationFields value={value.translations} active={active} onActiveChange={setActive} onChange={(translations) => setValue({ ...value, translations })} /></div>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={saving || uploading || Boolean(image)}>{saving ? t('admin.saving') : t('admin.save')}</Button>
        <Button type="button" variant="ghost" className="text-ink hover:bg-surface-2 hover:text-ink" disabled={saving || uploading} onClick={onCancel}>{t('admin.cancel')}</Button>
      </div>
    </form>
  );
}
