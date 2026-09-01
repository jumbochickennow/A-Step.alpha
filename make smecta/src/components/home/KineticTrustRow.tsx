import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { createKineticLabelSegments } from '../../lib/kinetic-label';

type KineticTrustItem = readonly [LucideIcon, string];

type KineticTrustRowProps = {
  items: readonly KineticTrustItem[];
};

type FeatureStyle = CSSProperties & {
  '--feature-index': number;
};

type SegmentStyle = CSSProperties & {
  '--segment-index': number;
};

const POINTER_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function KineticTrustRow({ items }: KineticTrustRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;

    const features = Array.from(row.querySelectorAll<HTMLElement>('[data-kinetic-feature]'));
    const finePointer = window.matchMedia(POINTER_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let frame = 0;
    let listening = false;
    let pendingFeature: HTMLElement | null = null;
    let pendingX = 0;
    let pendingY = 0;

    row.dataset.motionReady = 'true';

    const reveal = () => {
      row.dataset.visible = 'true';
    };

    let observer: IntersectionObserver | undefined;
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      reveal();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          reveal();
          observer?.disconnect();
        },
        { threshold: 0.3 },
      );
      observer.observe(row);
    }

    const resetFeature = (feature: HTMLElement) => {
      feature.style.removeProperty('--pointer-x');
      feature.style.removeProperty('--pointer-y');
      feature.style.removeProperty('--tilt-x');
      feature.style.removeProperty('--tilt-y');
      feature.style.removeProperty('--icon-x');
    };

    const flushPointer = () => {
      frame = 0;
      if (!pendingFeature) return;
      pendingFeature.style.setProperty('--pointer-x', `${pendingX.toFixed(2)}px`);
      pendingFeature.style.setProperty('--pointer-y', `${pendingY.toFixed(2)}px`);
      pendingFeature.style.setProperty('--tilt-x', `${(-pendingY * 0.55).toFixed(2)}deg`);
      pendingFeature.style.setProperty('--tilt-y', `${(pendingX * 0.7).toFixed(2)}deg`);
      pendingFeature.style.setProperty('--icon-x', `${(pendingX * 0.45).toFixed(2)}px`);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const feature = event.currentTarget as HTMLElement;
      const bounds = feature.getBoundingClientRect();
      pendingFeature = feature;
      pendingX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pendingY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      if (!frame) frame = window.requestAnimationFrame(flushPointer);
    };

    const handlePointerLeave = (event: PointerEvent) => {
      const feature = event.currentTarget as HTMLElement;
      if (pendingFeature === feature) pendingFeature = null;
      resetFeature(feature);
    };

    const syncPointerListeners = () => {
      const shouldListen = finePointer.matches && !reducedMotion.matches;
      if (shouldListen === listening) return;

      features.forEach((feature) => {
        if (shouldListen) {
          feature.addEventListener('pointermove', handlePointerMove, { passive: true });
          feature.addEventListener('pointerleave', handlePointerLeave);
        } else {
          feature.removeEventListener('pointermove', handlePointerMove);
          feature.removeEventListener('pointerleave', handlePointerLeave);
          resetFeature(feature);
        }
      });
      listening = shouldListen;
    };

    const handleMotionPreference = () => {
      if (reducedMotion.matches) reveal();
      syncPointerListeners();
    };

    syncPointerListeners();
    finePointer.addEventListener('change', syncPointerListeners);
    reducedMotion.addEventListener('change', handleMotionPreference);

    return () => {
      observer?.disconnect();
      finePointer.removeEventListener('change', syncPointerListeners);
      reducedMotion.removeEventListener('change', handleMotionPreference);
      features.forEach((feature) => {
        feature.removeEventListener('pointermove', handlePointerMove);
        feature.removeEventListener('pointerleave', handlePointerLeave);
      });
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rowRef} className="kinetic-trust-row mt-16 grid min-h-[8.5rem] w-full max-w-4xl grid-cols-2 gap-y-6 md:min-h-12 md:grid-cols-4">
      {items.map(([Icon, label], featureIndex) => {
        const segments = createKineticLabelSegments(label);

        return (
          <div
            key={label}
            data-kinetic-feature
            role="group"
            tabIndex={0}
            aria-label={label}
            className="kinetic-trust-feature relative flex items-center justify-center gap-3 px-3 text-[0.7rem] text-ink-muted md:[&:not(:first-child)]:before:absolute md:[&:not(:first-child)]:before:inset-y-1 md:[&:not(:first-child)]:before:start-0 md:[&:not(:first-child)]:before:w-px md:[&:not(:first-child)]:before:bg-white/10"
            style={{ '--feature-index': featureIndex } as FeatureStyle}
          >
            <span className="kinetic-trust-icon grid size-8 shrink-0 place-items-center rounded-full bg-[rgb(34_77_199/0.35)] text-brand-blue-text" aria-hidden="true">
              <Icon size={14} />
            </span>
            <span className="kinetic-trust-label" aria-hidden="true">
              {segments.map((segment, segmentIndex) => (
                <span
                  key={`${segmentIndex}-${segment.text}`}
                  className={segment.isSpace ? 'kinetic-trust-segment kinetic-trust-space' : 'kinetic-trust-segment'}
                  style={{ '--segment-index': segmentIndex } as SegmentStyle}
                >
                  {segment.text}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
