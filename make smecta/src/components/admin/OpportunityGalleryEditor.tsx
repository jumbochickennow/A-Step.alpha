import { useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { removeAdminOpportunityGalleryImage, uploadAdminOpportunityGalleryImage } from '../../services/admin.service';
import type { Opportunity } from '../../types/content';
import { Button } from '../common/Button';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_GALLERY_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/avif', 'image/jpeg', 'image/png', 'image/webp']);
type GalleryImage = NonNullable<Opportunity['galleryImages']>[number];

async function prepareGalleryImage(file: File): Promise<File> {
  if (!IMAGE_TYPES.has(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) throw new Error('invalid_image');
  if (typeof createImageBitmap !== 'function') {
    if (file.size <= MAX_GALLERY_BYTES) return file;
    throw new Error('invalid_image');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size <= MAX_GALLERY_BYTES) return file;
    throw new Error('invalid_image');
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('invalid_image');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('invalid_image')), 'image/webp', 0.82,
    ));
    if (blob.size > MAX_GALLERY_BYTES) throw new Error('invalid_image');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
}

function GallerySlot({ slot, imagePath, disabled, ensureDraft, onChange, onBusyChange }: {
  slot: number;
  imagePath?: string;
  disabled: boolean;
  ensureDraft: () => Promise<string>;
  onChange: (slot: number, imagePath: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedFile) { setPreviewUrl(null); return undefined; }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) {
      setError(t('admin.invalidImage'));
      return;
    }
    setSelectedFile(file);
    setProgress(0);
    setError(null);
    onBusyChange(true);
    try {
      const optimized = await prepareGalleryImage(file);
      const id = await ensureDraft();
      const path = await uploadAdminOpportunityGalleryImage(id, slot, optimized, setProgress);
      onChange(slot, path);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'invalid_image' ? t('admin.invalidImage') : t('admin.galleryUploadError'));
    } finally {
      setSelectedFile(null);
      setProgress(null);
      onBusyChange(false);
    }
  };

  const remove = async () => {
    if (!imagePath || !window.confirm(t('admin.galleryRemoveConfirm'))) return;
    setError(null);
    onBusyChange(true);
    try {
      const id = await ensureDraft();
      await removeAdminOpportunityGalleryImage(id, slot);
      onChange(slot, null);
    } catch {
      setError(t('admin.galleryRemoveError'));
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <p className="mb-2 text-xs font-semibold text-ink">{t('admin.gallerySlot', { slot })}</p>
      <div className="mb-3 aspect-[3/2] overflow-hidden rounded-md bg-bg">
        {previewUrl || imagePath ? <img src={previewUrl || imagePath} alt={t('admin.gallerySlot', { slot })} width="300" height="200" className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-xs text-ink-muted">{t('admin.galleryEmpty')}</div>}
      </div>
      <label className="block cursor-pointer rounded-md border border-border-strong px-3 py-2 text-center text-xs font-semibold text-ink hover:border-brand-blue-text focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-blue-text">
        {imagePath ? t('admin.replaceImage') : t('admin.uploadImage')}
        <input type="file" accept="image/avif,image/jpeg,image/png,image/webp,.avif,.jpg,.jpeg,.png,.webp" className="sr-only" disabled={disabled} onChange={(event) => void upload(event)} aria-label={t('admin.gallerySlot', { slot })} />
      </label>
      {imagePath ? <Button type="button" variant="ghost" className="mt-2 min-h-11 w-full text-xs text-ink-muted" disabled={disabled} onClick={() => void remove()}>{t('admin.galleryRemove')}</Button> : null}
      {progress !== null ? <progress className="mt-2 w-full" max="100" value={progress} aria-label={`${progress}%`} /> : null}
      {error ? <p className="mt-2 text-xs text-[var(--danger)]" role="alert">{error}</p> : null}
    </div>
  );
}

export function OpportunityGalleryEditor({ images, disabled, ensureDraft, onChange, onBusyChange }: {
  images: GalleryImage[];
  disabled: boolean;
  ensureDraft: () => Promise<string>;
  onChange: (slot: number, imagePath: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 border-t border-border pt-5" aria-labelledby="opportunity-gallery-title">
      <h3 id="opportunity-gallery-title" className="text-base font-bold">{t('admin.galleryTitle')}</h3>
      <p className="mt-1 text-xs leading-5 text-ink-muted">{t('admin.galleryHelp')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => {
          const slot = index + 1;
          return <GallerySlot key={slot} slot={slot} imagePath={images.find((image) => image.slot === slot)?.imagePath} disabled={disabled} ensureDraft={ensureDraft} onChange={onChange} onBusyChange={onBusyChange} />;
        })}
      </div>
    </section>
  );
}
