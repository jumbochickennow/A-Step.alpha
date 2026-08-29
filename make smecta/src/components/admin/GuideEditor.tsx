import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CATEGORIES, categoryLabel } from '../../lib/constants';
import { saveAdminGuide } from '../../services/admin.service';
import type { Guide, Locale } from '../../types/content';
import { Button } from '../common/Button';
import { TranslationFields } from './TranslationFields';

const emptyTranslations = {
  en: { title: '', description: '' }, fr: { title: '', description: '' }, ar: { title: '', description: '' },
};

export function GuideEditor({ guide, onCancel, onSaved }: { guide?: Guide; onCancel: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Locale>('en');
  const [value, setValue] = useState<Omit<Guide, 'id'> & { id?: string }>({
    id: guide?.id,
    slug: guide?.slug ?? '',
    category: guide?.category ?? 'France',
    filePath: guide?.filePath ?? null,
    fileType: guide?.fileType ?? 'PDF',
    pageCount: guide?.pageCount ?? 41,
    coverPath: guide?.coverPath ?? null,
    published: guide?.published ?? false,
    sortOrder: guide?.sortOrder ?? 0,
    contentUpdatedAt: guide?.contentUpdatedAt ?? new Date().toISOString().slice(0, 10),
    translations: guide?.translations ?? emptyTranslations,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (Object.values(value.translations).some((copy) => !copy.title.trim() || !copy.description.trim())) { setError(true); return; }
    const slug = value.slug.trim();
    setSaving(true); setError(false);
    try {
      await saveAdminGuide({ ...value, slug });
      toast.success(t('admin.saved'));
      onSaved();
    } catch { setError(true); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold">{t('admin.slug')}<input className="field mt-2" value={value.slug} onChange={(e) => setValue({ ...value, slug: e.target.value })} pattern="[a-z0-9-]+" required /></label>
        <label className="text-sm font-semibold">{t('admin.category')}<select className="field mt-2" value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value })}>{CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item, t)}</option>)}</select></label>
        <label className="text-sm font-semibold">{t('admin.sortOrder')}<input type="number" className="field mt-2" value={value.sortOrder} onChange={(e) => setValue({ ...value, sortOrder: Number(e.target.value) })} /></label>
        <label className="text-sm font-semibold">{t('admin.updatedDate')}<input type="date" className="field mt-2" value={value.contentUpdatedAt} onChange={(e) => setValue({ ...value, contentUpdatedAt: e.target.value })} required /></label>
        <label className="text-sm font-semibold">{t('admin.pageCount')}<input type="number" min="1" className="field mt-2" value={value.pageCount} onChange={(e) => setValue({ ...value, pageCount: Number(e.target.value) })} required /></label>
        <label className="text-sm font-semibold md:col-span-2">{t('admin.pdf')}<input type="text" className="field mt-2" value={value.filePath ?? ''} onChange={(e) => setValue({ ...value, filePath: e.target.value || null })} placeholder="example.pdf" /></label>
        <div className="flex flex-wrap items-center gap-3 text-sm md:col-span-2">
          {value.filePath ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(52_211_153/0.35)] bg-[rgb(52_211_153/0.12)] px-3 py-1 font-semibold text-[var(--success)]">
              ✓ Deployed PDF: {value.filePath}
            </span>
          ) : (
            <span className="text-ink-muted">Runtime uploads are disabled; deploy scanned PDFs to the private guide bucket.</span>
          )}
        </div>
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={value.published} onChange={(e) => setValue({ ...value, published: e.target.checked })} className="size-4 accent-[var(--blue)]" />{t('admin.published')}</label>
      <div className="mt-6"><TranslationFields value={value.translations} active={active} onActiveChange={setActive} onChange={(translations) => setValue({ ...value, translations })} /></div>
      {error ? <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{t('admin.loadError')}</p> : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button type="submit" disabled={saving}>{saving ? t('admin.saving') : t('admin.save')}</Button><Button type="button" variant="ghost" onClick={onCancel}>{t('admin.cancel')}</Button></div>
    </form>
  );
}
