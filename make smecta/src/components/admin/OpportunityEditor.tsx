import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { saveAdminOpportunity } from '../../services/admin.service';
import { ApiError } from '../../services/api-client';
import type { Locale, Opportunity } from '../../types/content';
import { Button } from '../common/Button';
import { TranslationFields } from './TranslationFields';

const emptyTranslations = { en: { title: '', description: '' }, fr: { title: '', description: '' }, ar: { title: '', description: '' } };
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp']);

export function OpportunityEditor({ opportunity, onCancel, onSaved }: { opportunity?: Opportunity; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Locale>('en');
  const [categories, setCategories] = useState(opportunity?.categories.join(', ') ?? 'Scholarships');
  const [value, setValue] = useState<Omit<Opportunity, 'id'> & { id?: string }>({
    id: opportunity?.id, slug: opportunity?.slug ?? '', country: opportunity?.country ?? 'France', categories: opportunity?.categories ?? ['Scholarships'], imagePath: opportunity?.imagePath ?? null,
    applyUrl: opportunity?.applyUrl ?? '', opensAt: opportunity?.opensAt ?? '', deadline: opportunity?.deadline ?? '', featured: opportunity?.featured ?? false, published: opportunity?.published ?? false,
    translations: opportunity?.translations ?? emptyTranslations,
  });
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messageFor = (cause: unknown) => cause instanceof ApiError ? cause.message : t('admin.loadError');

  const selectImage = (file?: File) => {
    if (file && (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES)) {
      setImage(null);
      setError(t('admin.invalidImage'));
      return;
    }
    setImage(file ?? null);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = { ...value, categories: categories.split(',').map((item) => item.trim()).filter(Boolean) };
    if (Object.values(next.translations).some((copy) => !copy.title.trim() || !copy.description.trim())) { setError(t('admin.translationRequired')); return; }
    const slug = next.slug.trim();
    setSaving(true); setError(null);
    try {
      await saveAdminOpportunity({ ...next, slug }, image);
      toast.success(t('admin.saved'));
      onSaved();
    } catch (cause) { setError(messageFor(cause)); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold">{t('admin.slug')}<input className="field mt-2" value={value.slug} onChange={(e) => setValue({ ...value, slug: e.target.value })} pattern="[a-z0-9-]+" required /></label>
        <label className="text-sm font-semibold">{t('admin.country')}<input className="field mt-2" value={value.country} onChange={(e) => setValue({ ...value, country: e.target.value })} required /></label>
        <label className="text-sm font-semibold md:col-span-2">{t('admin.categories')}<input className="field mt-2" value={categories} onChange={(e) => setCategories(e.target.value)} required /></label>
        <label className="text-sm font-semibold">{t('admin.opensAt')}<input type="date" className="field mt-2" value={value.opensAt ?? ''} onChange={(e) => setValue({ ...value, opensAt: e.target.value })} /></label>
        <label className="text-sm font-semibold">{t('admin.deadline')}<input type="date" className="field mt-2" value={value.deadline ?? ''} onChange={(e) => setValue({ ...value, deadline: e.target.value })} /></label>
        <label className="text-sm font-semibold md:col-span-2">{t('admin.applyUrl')}<input type="url" className="field mt-2" value={value.applyUrl ?? ''} onChange={(e) => setValue({ ...value, applyUrl: e.target.value })} /></label>
        <label className="text-sm font-semibold md:col-span-2">
          {t('admin.image')}
          <input
            type="file"
            accept="image/avif,image/jpeg,image/png,image/webp,.avif,.jpg,.jpeg,.png,.webp"
            className="mt-2 block w-full text-sm text-ink-muted file:me-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
            onChange={(event) => selectImage(event.target.files?.[0])}
          />
          <span className="mt-2 block text-xs font-normal text-ink-muted">
            {image ? t('admin.selectedImage', { name: image.name }) : t('admin.imageUploadHelp')}
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-2">
          {value.imagePath ? (
            <>
              <img src={value.imagePath} alt="" width={96} height={64} className="h-16 w-24 rounded-lg object-cover" />
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(52_211_153/0.35)] bg-[rgb(52_211_153/0.12)] px-3 py-1 font-semibold text-[var(--success)]">
                ✓ Deployed image: {value.imagePath}
              </span>
            </>
          ) : (
            <span className="text-ink-muted">{t('admin.imageNotUploaded')}</span>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-6"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={value.published} onChange={(e) => setValue({ ...value, published: e.target.checked })} className="size-4 accent-[var(--blue)]" />{t('admin.published')}</label><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={value.featured} onChange={(e) => setValue({ ...value, featured: e.target.checked })} className="size-4 accent-[var(--blue)]" />{t('admin.featured')}</label></div>
      <div className="mt-6"><TranslationFields value={value.translations} active={active} onActiveChange={setActive} onChange={(translations) => setValue({ ...value, translations })} /></div>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button type="submit" disabled={saving}>{saving ? t('admin.saving') : t('admin.save')}</Button><Button type="button" variant="ghost" onClick={onCancel}>{t('admin.cancel')}</Button></div>
    </form>
  );
}
