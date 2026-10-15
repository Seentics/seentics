'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A product screen as a picture: a frameless window with a hairline edge, its contents
 * laid out at their design size and scaled to the column.
 *
 * Decorative: not focusable, not announced, not clickable — the words around it carry the
 * meaning. `app-surface` gives the contents the app's own colours rather than the page's.
 */
export function ProductWindow({
  designWidth,
  designHeight,
  children,
  className,
  crop,
}: {
  designWidth: number;
  designHeight: number;
  children: ReactNode;
  className?: string;
  /** Show only this share of the screen's height, fading out at the bottom. */
  crop?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / designWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [designWidth]);

  const visible = crop ?? 1;
  const fade = crop ? 'linear-gradient(to bottom, black 0%, black 62%, transparent 100%)' : undefined;

  return (
    <div
      aria-hidden
      inert
      className={cn(
        'pointer-events-none relative select-none overflow-hidden rounded-xl border',
        className,
      )}
      style={{
        borderColor: 'var(--lx-line-strong)',
        boxShadow: 'var(--lx-shot-shadow)',
        WebkitMaskImage: fade,
        maskImage: fade,
      }}
    >
      {/* The light catching the top edge. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/25" />
      <div className="app-surface bg-background">
        <div ref={ref} className="relative w-full" style={{ aspectRatio: `${designWidth} / ${designHeight * visible}` }}>
          <div
            className="absolute left-0 top-0 flex origin-top-left flex-col"
            style={{
              width: designWidth,
              height: designHeight,
              transform: scale ? `scale(${scale})` : undefined,
              visibility: scale ? 'visible' : 'hidden',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
