import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { listAdminRecords, type AdminRecord } from '../../services/admin.service';
import { cn } from '../../lib/utils';
import { Button } from '../common/Button';

/* ------------------------------------------------------------------ */
/* Generic typed table                                                 */
/* ------------------------------------------------------------------ */

export interface ColumnDef<T> {
  /** Property of `T` to display when no custom `render` is provided. */
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

export interface RecordsTableProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

function cellValue<T extends { id: string }>(item: T, key: keyof T | string): string {
  const value = (item as Record<string, unknown>)[key as string];
  return value === null || value === undefined ? '' : String(value);
}

/** Fully typed, reusable records table with generic column contracts. */
export function RecordsTable<T extends { id: string }>({ data, columns, isLoading = false, emptyMessage, onRowClick }: RecordsTableProps<T>): ReactNode {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="card mt-6 flex items-center justify-center py-12" aria-busy="true" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="card mt-6 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} scope="col" className="border-b border-border p-3 text-start font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-6 text-center text-ink-muted">
                {emptyMessage ?? t('admin.empty')}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn('border-b border-[rgb(44_54_72/0.6)]', onRowClick && 'cursor-pointer hover:bg-surface-2/60')}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className={cn('max-w-xs truncate p-3 text-ink-muted', column.className)}>
                    {column.render ? column.render(item) : cellValue(item, column.key) || '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legacy table-keyed admin section (CSV export + record fetching)     */
/* ------------------------------------------------------------------ */

type TableName = 'guide_download_leads' | 'newsletter_subscribers' | 'contact_messages';

function csvValue(value: unknown): string {
  const raw = String(value ?? '');
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function AdminRecordTable({ table, title }: { table: TableName; title: string }): ReactNode {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    void listAdminRecords(table)
      .then(setRows)
      .catch(() => setError(true));
  }, [table]);

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  const exportCsv = (): void => {
    const csv = [
      columns.map(csvValue).join(','),
      ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${table}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="section-title">{title}</h2>
        <Button variant="ghost" disabled={!rows.length} onClick={exportCsv}>
          {t('admin.exportCsv')}
        </Button>
      </div>
      {error ? (
        <p className="mt-6 text-[var(--danger)]">{t('admin.loadError')}</p>
      ) : !rows.length ? (
        <p className="card mt-6 p-6 text-ink-muted">{t('admin.empty')}</p>
      ) : (
        <RecordsTable<AdminRecord>
          data={rows}
          columns={columns.map((column) => ({ key: column, header: column, className: 'capitalize' }))}
          emptyMessage={t('admin.empty')}
        />
      )}
    </div>
  );
}

/** Table-keyed admin section backed by remote/local record readers. */
export const AdminRecordsTable = AdminRecordTable;
