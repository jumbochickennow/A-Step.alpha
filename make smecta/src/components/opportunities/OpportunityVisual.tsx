import { Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { categoryLabel } from '../../lib/constants';

const IMAGE_DIMENSIONS = {
  '/assets/opportunities/spain.jpg': [270, 180],
  '/assets/opportunities/shanghai.jpg': [857, 180],
  '/assets/opportunities/saudi.jpg': [270, 180],
  '/assets/opportunities/shenzhen.jpg': [268, 180],
} as const;

export function OpportunityVisual({ country, imagePath, priority = false, slug }: { country: string; imagePath: string | null; priority?: boolean; slug?: string }) {
  const { t } = useTranslation();
  void slug;

  const designImages: Record<string, string> = {
    Europe: '/assets/opportunities/spain.jpg',
    France: '/assets/opportunities/shanghai.jpg',
    Germany: '/assets/opportunities/saudi.jpg',
    China: '/assets/opportunities/shenzhen.jpg',
  };
  const resolvedImage = imagePath || designImages[country];
  if (resolvedImage) {
    const [width, height] = IMAGE_DIMENSIONS[resolvedImage as keyof typeof IMAGE_DIMENSIONS] ?? [800, 450];
    return (
      <img
        src={resolvedImage}
        width={width}
        height={height}
        style={{ aspectRatio: `${width} / ${height}` }}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="relative flex h-full min-h-48 items-end overflow-hidden bg-[radial-gradient(circle_at_72%_30%,rgb(77_163_245/0.34),transparent_34%),linear-gradient(135deg,#0d2946,#131822_70%)] p-6" aria-hidden="true">
      <div className="absolute end-5 top-5 grid size-20 place-items-center rounded-full border border-white/10 bg-white/5 text-brand-blue-text">
        <Globe2 size={38} />
      </div>
      <span className="relative text-sm font-semibold uppercase tracking-[0.14em] text-white/80">{categoryLabel(country, t)}</span>
    </div>
  );
}
