import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CATEGORIES, categoryLabel } from '../../lib/constants';
import { saveAdminGuide, uploadAdminGuidePdf } from '../../services/admin.service';
import { ApiError } from '../../services/api-client';
import type { Guide, GuideLanguage, Locale } from '../../types/content';
import { Button } from '../common/Button';
import { TranslationFields } from './TranslationFields';

const emptyTranslations = {
  en: { title: '', description: '' }, fr: { title: '', description: '' }, ar: { title: '', description: '' },
};

const PDF_SLOTS: Array<{ language: GuideLanguage; field: 'r2KeyEn' | 'r2KeyFr' | 'r2KeyAr'; label: string }> = [
  { language: 'en', field: 'r2KeyEn', label: 'admin.pdfEnglish' },
  { language: 'fr', field: 'r2KeyFr', label: 'admin.pdfFrench' },
  { language: 'ar', field: 'r2KeyAr', label: 'admin.pdfArabic' },
];
const MAX_PDF_BYTES = 50 * 1024 * 1024;

export function GuideEditor({ guide, onCancel, onSaved }: { guide?: Guide; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Locale>('en');
  const [value, setValue] = useState<Omit<Guide, 'id'> & { id?: string }>({
    id: guide?.id,
    slug: guide?.slug ?? '',
    category: guide?.category ?? 'France',
    filePath: guide?.filePath ?? null,
    r2KeyEn: guide?.r2KeyEn ?? guide?.filePath ?? null,
    r2KeyFr: guide?.r2KeyFr ?? null,
    r2KeyAr: guide?.r2KeyAr ?? null,
    fileType: guide?.fileType ?? 'PDF',
    pageCount: guide?.pageCount ?? 41,
    coverPath: guide?.coverPath ?? null,
    published: guide?.published ?? false,
    sortOrder: guide?.sortOrder ?? 0,
    contentUpdatedAt: guide?.contentUpdatedAt ?? new Date().toISOString().slice(0, 10),
    translations: guide?.translations ?? emptyTranslations,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<GuideLanguage | null>(null);
  const [files, setFiles] = useState<Partial<Record<GuideLanguage, File>>>({});
  const [error, setError] = useState<string | null>(null);

  const messageFor = (cause: unknown) => cause instanceof ApiError ? cause.message : t('admin.loadError');

  const selectPdf = (language: GuideLanguage, file?: File) => {
    if (file && ((!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') || file.size > MAX_PDF_BYTES)) {
      setError(t('admin.invalidPdf'));
      return;
    }
    setError(null);
    setFiles((current) => ({ ...current, [language]: file }));
  };

  const uploadPdf = async (language: GuideLanguage, field: 'r2KeyEn' | 'r2KeyFr' | 'r2KeyAr') => {
    const file = files[language];
    if (!value.id || !file) return;
    setUploading(language); setError(null);
    try {
      const objectKey = await uploadAdminGuidePdf(value.id, language, file);
      setValue((current) => ({
        ...current,
        [field]: objectKey,
        filePath: language === 'en' ? objectKey : current.filePath,
      }));
      setFiles((current) => ({ ...current, [language]: undefined }));
      toast.success(t('admin.pdfUploaded'));
    } catch (cause) { setError(messageFor(cause)); } finally { setUploading(null); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (Object.values(value.translations).some((copy) => !copy.title.trim() || !copy.description.trim())) { setError(t('admin.translationRequired')); return; }
    const slug = value.slug.trim();
    setSaving(true); setError(null);
    try {
      await saveAdminGuide({ ...value, slug });
      toast.success(t('admin.saved'));
      onSaved();
    } catch (cause) { setError(messageFor(cause)); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold">{t('admin.slug')}<input className="field mt-2" value={value.slug} onChange={(e) => setValue({ ...value, slug: e.target.value })} pattern="[a-z0-9-]+" required /></label>
        <label className="text-sm font-semibold">{t('admin.category')}<select className="field mt-2" value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value })}>{CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item, t)}</option>)}</select></label>
        <label className="text-sm font-semibold">{t('admin.sortOrder')}<input type="number" className="field mt-2" value={value.sortOrder} onChange={(e) => setValue({ ...value, sortOrder: Number(e.target.value) })} /></label>
        <label className="text-sm font-semibold">{t('admin.updatedDate')}<input type="date" className="field mt-2" value={value.contentUpdatedAt} onChange={(e) => setValue({ ...value, contentUpdatedAt: e.target.value })} required /></label>
        <label className="text-sm font-semibold">{t('admin.pageCount')}<input type="number" min="1" className="field mt-2" value={value.pageCount} onChange={(e) => setValue({ ...value, pageCount: Number(e.target.value) })} required /></label>
        <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
          {PDF_SLOTS.map(({ language, field, label }) => {
            const deployed = value[field];
            return (
              <section key={language} className="rounded-xl border border-border bg-surface-2 p-4">
                <h3 className="text-sm font-semibold">{t(label)}</h3>
                <p className="mt-1 min-h-10 break-all text-xs text-ink-muted">{deployed ?? t('admin.pdfNotUploaded')}</p>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="mt-3 block w-full text-xs text-ink-muted file:me-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-semibold file:text-white"
                  onChange={(event) => selectPdf(language, event.target.files?.[0])}
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={!value.id || !files[language] || uploading !== null}
                  onClick={() => void uploadPdf(language, field)}
                >
                  {uploading === language ? t('admin.uploadingPdf') : t(deployed ? 'admin.replacePdf' : 'admin.uploadPdf')}
                </Button>
              </section>
            );
          })}
        </div>
        {!value.id ? <p className="text-xs text-ink-muted md:col-span-2">{t('admin.saveBeforeUpload')}</p> : null}
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={value.published} onChange={(e) => setValue({ ...value, published: e.target.checked })} className="size-4 accent-[var(--blue)]" />{t('admin.published')}</label>
      <div className="mt-6"><TranslationFields value={value.translations} active={active} onActiveChange={setActive} onChange={(translations) => setValue({ ...value, translations })} /></div>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button type="submit" disabled={saving}>{saving ? t('admin.saving') : t('admin.save')}</Button><Button type="button" variant="ghost" onClick={onCancel}>{t('admin.cancel')}</Button></div>
    </form>
  );
}
