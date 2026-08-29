import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteAdminGuide, listAdminGuides } from '../../services/admin.service';
import type { Guide } from '../../types/content';
import { Button } from '../common/Button';
import { GuideEditor } from './GuideEditor';
import { categoryLabel } from '../../lib/constants';

export const GUIDE_SLOT_CAP = 20;
const PAGE_SIZE = 6;

export function GuideManager() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Guide[]>([]);
  const [editing, setEditing] = useState<Guide | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const load = async () => { try { setRows(await listAdminGuides()); setEditing(undefined); setError(false); } catch { setError(true); } };
  useEffect(() => { void load(); }, []);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.sortOrder - b.sortOrder), [rows]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const atCap = sorted.length >= GUIDE_SLOT_CAP;

  const remove = async (id: string) => { if (!window.confirm(t('admin.confirmDelete'))) return; await deleteAdminGuide(id); await load(); };
  if (editing !== undefined) return <GuideEditor guide={editing ?? undefined} onCancel={() => setEditing(undefined)} onSaved={() => void load()} />;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="section-title">{t('admin.guides')}</h2>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-muted">{sorted.length}/{GUIDE_SLOT_CAP} Guides</span>
          <Button onClick={() => setEditing(null)} disabled={atCap} title={atCap ? 'Guide slots are full (G1–G20)' : undefined}>{t('admin.addGuide')}</Button>
        </div>
      </div>
      {atCap ? <p className="mt-2 text-xs text-[var(--danger)]">All 20 guide slots (G1–G20) are occupied. Delete a guide to free a slot.</p> : null}
      {error ? <p className="mt-6 text-[var(--danger)]">{t('admin.loadError')}</p> : null}
      <div className="mt-6 space-y-3">
        {visible.map((guide, index) => (
          <div key={guide.id} className="card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-blue/10 text-xs font-extrabold text-brand-blue">G{(safePage - 1) * PAGE_SIZE + index + 1}</span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{guide.translations.en.title || guide.slug}</h3>
                <p className="mt-1 text-sm text-ink-muted">{categoryLabel(guide.category, t)} · {guide.published ? t('admin.published') : t('admin.draft')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(guide)}>{t('admin.edit')}</Button>
              <Button variant="ghost" onClick={() => void remove(guide.id)}>{t('admin.delete')}</Button>
            </div>
          </div>
        ))}
      </div>
      {pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button variant="ghost" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹ Previous</Button>
          <span className="rounded-lg bg-brand-blue px-3 py-1 font-bold text-white">{safePage}</span>
          <span className="text-ink-muted">/ {pageCount}</span>
          <Button variant="ghost" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next ›</Button>
        </div>
      ) : null}
    </div>
  );
}
