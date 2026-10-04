'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

/**
 * A real product demo in a browser window.
 *
 * The page is the product's own demo route in an iframe, laid out at desktop width and
 * scaled down to the column. It is view-only (`pointer-events-none`): the demos link to
 * signed-in pages, and a click inside the frame landed on signup or a 404. "Open" in the
 * title bar is the way into the full, clickable demo.
 * Nothing here is drawn or copied, which is why it cannot drift from the product.
 */
const DESIGN_W = 1440;
const DESIGN_H = 560;

const BAR_H = 38;

/** `height` fixes the whole window's height; the page inside is laid out taller or shorter to fill it. */
export function LiveDemoFrame({ src, label, title, height }: { src: string; label: string; title: string; height?: number }) {
  const area = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / DESIGN_W);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-3" style={{ height: BAR_H }}>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="mx-auto min-w-0 max-w-[380px] flex-1 truncate rounded-md bg-background/80 px-3 py-1 text-center text-[11px] text-muted-foreground">
          {label}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          Open
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div ref={area} className="relative w-full overflow-hidden bg-background" style={{ height: height ? height - BAR_H : DESIGN_H * scale }}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          src={src}
          title={title}
          onLoad={() => setLoaded(true)}
          className="pointer-events-none border-0"
          tabIndex={-1}
          style={{ width: DESIGN_W, height: height ? (height - BAR_H) / scale : DESIGN_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      </div>
    </div>
  );
}
