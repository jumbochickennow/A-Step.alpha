import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

type KineticTrustItem = readonly [LucideIcon, string];

type KineticTrustRowProps = {
  items: readonly KineticTrustItem[];
};

/**
 * Hero trust badges. Pure CSS: one `animate-fade-rise` per badge, staggered via
 * `animationDelay`, disabled under `prefers-reduced-motion`. Mobile is an equal
 * 2×2 grid with icons in one column and start-aligned labels (mirrors in RTL).
 */
export function KineticTrustRow({ items }: KineticTrustRowProps) {
  return (
    <ul className="mx-auto mt-16 grid w-full max-w-sm list-none grid-cols-2 gap-x-6 gap-y-5 p-0 md:max-w-4xl md:grid-cols-4 md:gap-y-0">
      {items.map(([Icon, label], index) => (
        <li
          key={label}
          className="flex min-w-0 items-center gap-3 text-start text-[0.7rem] text-ink-muted animate-fade-rise motion-reduce:animate-none md:justify-center md:px-3 md:[&:not(:first-child)]:border-s md:[&:not(:first-child)]:border-white/10"
          style={{ animationDelay: `${index * 80}ms` } as CSSProperties}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[rgb(34_77_199/0.35)] text-brand-blue-text" aria-hidden="true">
            <Icon size={14} />
          </span>
          <span className="min-w-0 leading-snug [text-wrap:balance]">{label}</span>
        </li>
      ))}
    </ul>
  );
}
