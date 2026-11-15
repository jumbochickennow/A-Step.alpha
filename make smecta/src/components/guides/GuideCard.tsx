import { FileCheck2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatMonthYear } from '../../lib/format';
import { categoryLabel, countryChipValue } from '../../lib/constants';
import type { LocalizedGuide } from '../../types/content';
import { localizedPath, useLocale } from '../../hooks/useLocale';
import { GuideDownloadDialog } from './GuideDownloadDialog';

export function GuideCard({ guide }: { guide: LocalizedGuide }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const countryChip = countryChipValue(guide.country);
  const fileLabel = /pdf/i.test(guide.fileType) ? 'PDF' : guide.fileType;
  return (
    <article className="group glow-edge card-hover flex min-h-[270px] h-full flex-col rounded-xl border border-border bg-[#212a3a] p-6 shadow-[0_10px_26px_rgb(0_0_0/0.35)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {countryChip ? (
            // 28px visual pill, 44px hit area via the ::before overlay.
            <Link
              to={localizedPath(`/guides?category=${countryChip}`, locale)}
              className="relative mb-3 inline-flex min-h-7 items-center rounded-full border border-white/20 px-2.5 text-micro font-semibold uppercase tracking-[0.12em] text-white/80 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']"
            >
              {categoryLabel(countryChip, t)}
            </Link>
          ) : null}
          <h3 className="text-xl font-bold leading-tight md:text-2xl"><bdi>{guide.title}</bdi></h3>
        </div>
        <FileCheck2 className="shrink-0 text-white transition-transform duration-300 group-hover:scale-110 ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:group-hover:scale-110" size={30} aria-hidden="true" />
      </div>
      <p className="mt-5 text-sm leading-relaxed text-white/65">{guide.description}</p>
      <div className="mt-auto flex items-end justify-between gap-5 pt-7">
        <div className="text-micro uppercase leading-relaxed text-white/70">
          <span className="block">{fileLabel}{guide.pageCount > 0 ? ` ${guide.pageCount}P` : ''}</span>
          <span className="block"><bdi>{t('guides.updated', { date: formatMonthYear(guide.contentUpdatedAt, locale) })}</bdi></span>
        </div>
        <GuideDownloadDialog guide={guide} triggerClassName="mt-0 min-h-11 shrink-0 rounded-md border border-white/35 bg-transparent px-5 py-2 text-sm text-white shadow-none hover:bg-white/10" />
      </div>
    </article>
  );
}
