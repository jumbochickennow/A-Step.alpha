import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteAdminOpportunity, listAdminOpportunities } from '../../services/admin.service';
import type { Opportunity } from '../../types/content';
import { Button } from '../common/Button';
import { OpportunityEditor } from './OpportunityEditor';
import { categoryLabel } from '../../lib/constants';

export const OPPORTUNITY_SLOT_CAP = 10;
const PAGE_SIZE = 6;

export function OpportunityManager() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [editing, setEditing] = useState<Opportunity | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const load = async () => { try { setRows(await listAdminOpportunities()); setEditing(undefined); setError(false); } catch { setError(true); } };
  useEffect(() => { void load(); }, []);

  const sorted = useMemo(() => [...rows].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')), [rows]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const atCap = sorted.length >= OPPORTUNITY_SLOT_CAP;

  const remove = async (id: string) => { if (!window.confirm(t('admin.confirmDelete'))) return; await deleteAdminOpportunity(id); await load(); };
  if (editing !== undefined) return <OpportunityEditor opportunity={editing ?? undefined} onCancel={() => setEditing(undefined)} onSaved={() => void load()} />;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="section-title">{t('admin.opportunities')}</h2>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-muted">{sorted.length}/{OPPORTUNITY_SLOT_CAP} Cards</span>
          <Button onClick={() => setEditing(null)} disabled={atCap} title={atCap ? 'Opportunity slots are full (C1–C10)' : undefined}>{t('admin.addOpportunity')}</Button>
        </div>
      </div>
      {atCap ? <p className="mt-2 text-xs text-[var(--danger)]">All 10 opportunity slots (C1–C10) are occupied. Delete a card to free a slot.</p> : null}
      {error ? <p className="mt-6 text-[var(--danger)]">{t('admin.loadError')}</p> : null}
      <div className="mt-6 space-y-3">
        {visible.map((item, index) => (
          <div key={item.id} className="card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-coral/10 text-xs font-extrabold text-brand-coral">C{(safePage - 1) * PAGE_SIZE + index + 1}</span>
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{item.translations.en.title || item.slug}</h3>
                <p className="mt-1 text-sm text-ink-muted">{categoryLabel(item.country, t)} · {item.deadline ?? t('common.comingSoon')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(item)}>{t('admin.edit')}</Button>
              <Button variant="ghost" onClick={() => void remove(item.id)}>{t('admin.delete')}</Button>
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