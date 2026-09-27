import { useEffect, useState } from 'react';
import { Images, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../hooks/useLocale';
import { whatsappHrefFor } from '../../lib/constants';
import { formatDate } from '../../lib/format';
import type { LocalizedOpportunity } from '../../types/content';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/Dialog';
import { OpportunityApplyControl } from './OpportunityApplyControl';
import { OpportunityVisual } from './OpportunityVisual';
import '../../styles/opportunity-detail.css';

export function OpportunityDetail({ opportunity, onClose, onReturnFocus }: { opportunity: LocalizedOpportunity | null; onClose: () => void; onReturnFocus: () => void }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [activeImage, setActiveImage] = useState(0);
  useEffect(() => { setActiveImage(0); }, [opportunity?.id]);
  const images = opportunity?.galleryImages?.length
    ? opportunity.galleryImages.map((image) => image.imagePath)
    : opportunity?.imagePath ? [opportunity.imagePath] : [];

  return (
    <Dialog open={Boolean(opportunity)} onOpenChange={(open) => { if (!open) onClose(); }}>
      {opportunity ? (
        <DialogContent
          aria-describedby="opportunity-detail-description"
          onCloseAutoFocus={(event) => { event.preventDefault(); onReturnFocus(); }}
          overlayClassName="opportunity-detail-overlay"
          className="opportunity-detail-dialog max-h-[84dvh] w-[calc(100%-2rem)] max-w-[680px] border-border-strong bg-surface-1 p-0 text-ink sm:w-[min(88vw,680px)] lg:w-[40vw] lg:max-w-none"
        >
          <div className="p-5 pb-6 sm:p-7">
            <div className="pe-12">
              <p className="text-xs font-semibold text-brand-coral">{t('opportunities.detailEyebrow')}</p>
              <DialogTitle className="mt-2 text-xl font-bold leading-snug sm:text-2xl">{opportunity.title}</DialogTitle>
              <p className="mt-2 text-xs text-ink-muted">
                {opportunity.country}{opportunity.deadline ? <> · <bdi>{t('opportunities.deadline', { date: formatDate(opportunity.deadline, locale) })}</bdi></> : null}
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg bg-bg">
              {images.length ? (
                <img
                  key={images[Math.min(activeImage, images.length - 1)]}
                  src={images[Math.min(activeImage, images.length - 1)]}
                  alt={t('opportunities.galleryImage', { index: Math.min(activeImage, images.length - 1) + 1, total: images.length, title: opportunity.title })}
                  width="800"
                  height="520"
                  decoding="async"
                  className="opportunity-detail-image aspect-[3/2] w-full object-cover"
                />
              ) : (
                <div className="aspect-[3/2]"><OpportunityVisual country={opportunity.country} imagePath={null} /></div>
              )}
            </div>
            {images.length > 1 ? (
              <div className="mt-3">
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-ink-muted"><Images size={15} aria-hidden="true" />{t('opportunities.galleryCount', { count: images.length })}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label={t('opportunities.gallery')}>
                  {images.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={t('opportunities.selectImage', { index: index + 1, total: images.length })}
                      aria-pressed={activeImage === index}
                      className="min-h-11 overflow-hidden rounded-md border-2 border-transparent transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-blue-text focus-visible:border-brand-blue-text aria-pressed:border-brand-coral motion-reduce:transform-none motion-reduce:transition-none"
                    >
                      <img src={image} alt="" width="120" height="80" loading="lazy" decoding="async" className="aspect-[3/2] w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <DialogDescription id="opportunity-detail-description" className="mt-6 whitespace-pre-line text-sm leading-7 text-ink-muted">
              {opportunity.description}
            </DialogDescription>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
              <OpportunityApplyControl opportunity={opportunity} withIcon linkClassName="group/apply inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-100" />
              <a
                href={whatsappHrefFor({ type: 'opportunity', title: opportunity.title, locale })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-5 text-sm font-semibold text-ink hover:border-brand-blue-text"
              >
                <MessageCircle size={16} aria-hidden="true" />{t('opportunities.askWhatsapp')}
              </a>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
