'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Lock, Plus, RotateCw, Share } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Height of the browser chrome, in design pixels.
 *
 * It comes out of the app's share of the screen rather than being added below it, so
 * `designHeight` stays the true 16:10 lid and the shell never stretches.
 */
const CHROME_H = 40;

/**
 * The browser window the app is running in.
 *
 * Without it the app started at the top edge of the lid, which no screen ever shows —
 * a dashboard with no window around it reads as a design file, not a computer. Traffic
 * lights, an address bar and nothing else: a tab strip would add a second row of
 * chrome competing with the app's own header for the same glance.
 *
 * Unlike the chassis, this does follow the theme — a browser window is drawn by the OS
 * the visitor is actually using, and a light window around a dark dashboard looks
 * wrong in exactly the way a light laptop would not.
 */
function BrowserChrome({ url }: { url: string }) {
  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b border-black/10 bg-[#e6e6e9] px-3 dark:border-white/[0.06] dark:bg-[#2b2b2e]"
      style={{ height: CHROME_H }}
    >
      <div className="flex shrink-0 gap-[6px]">
        <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
      </div>

      <div className="flex shrink-0 items-center gap-1 text-black/25 dark:text-white/25">
        <ChevronLeft className="h-[15px] w-[15px]" />
        <ChevronRight className="h-[15px] w-[15px]" />
        <RotateCw className="ml-0.5 h-[13px] w-[13px]" />
      </div>

      {/* Address bar */}
      <div className="mx-auto flex min-w-0 max-w-[420px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/85 px-3 py-[5px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:bg-black/40 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
        <Lock className="h-[11px] w-[11px] shrink-0 text-black/45 dark:text-white/45" />
        <span className="min-w-0 truncate text-[11px] leading-none text-black/65 dark:text-white/60">
          {url}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-black/25 dark:text-white/25">
        <Share className="h-[14px] w-[14px]" />
        <Plus className="h-[15px] w-[15px]" />
      </div>
    </div>
  );
}

/**
 * A product mock in a MacBook, laid out at real desktop width and scaled to fit.
 *
 * Two problems, one component.
 *
 * The screens these mocks copy are 1100–1560px wide, and reflowing one into a 700px
 * marketing column stops it looking like the product: cards stack, tables shed
 * columns, the sidebar collapses. So the mock is built at `designWidth` — where every
 * layout resolves the way it does in the app — and then shrunk, the way a screenshot
 * would be. `scale` is measured rather than hardcoded, so one mock fills whatever
 * column it lands in.
 *
 * The laptop is what makes it read as a screen rather than a floating panel. Keep
 * `designWidth / designHeight` at 16:10 — a MacBook's real aspect — or the shell will
 * look like a shell around something else.
 *
 * The chassis does not follow the theme (a laptop is an object; it is the same colour
 * in a dark room) but the screen does: `app-surface` opts the subtree back out of the
 * landing page's white canvas into the app's own tokens, so the mock renders in
 * whichever palette the visitor is reading the page in.
 *
 * Everything inside is decoration: `aria-hidden` and `pointer-events-none`, because
 * every "control" in here is a div that does nothing. A screen reader announcing a
 * fake sidebar full of fake links would be worse than announcing nothing.
 */
export function MacbookFrame({
  designWidth,
  designHeight,
  url,
  children,
  className,
}: {
  designWidth: number;
  designHeight: number;
  /** What the address bar reads — the route this screen actually lives at. */
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / designWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div aria-hidden className={cn('pointer-events-none relative select-none', className)}>
      {/* Lid — aluminium edge */}
      <div
        className={cn(
          'relative rounded-[14px] bg-gradient-to-b from-zinc-600 to-zinc-800 p-[7px]',
          'shadow-[0_30px_60px_-12px_rgba(0,0,0,0.28),0_12px_24px_-8px_rgba(0,0,0,0.16)]',
          'dark:shadow-[0_30px_70px_-12px_rgba(0,0,0,0.65),0_12px_24px_-8px_rgba(0,0,0,0.4)]',
        )}
      >
        {/* Bezel — barely more headroom at the top than at the sides, which is what a
            current lid looks like. It started at 15px and the camera then floated in
            a band of dead black wider than the chin, which reads as a mistake. */}
        <div className="relative overflow-hidden rounded-[9px] bg-black px-[5px] pb-[6px] pt-[9px] ring-1 ring-inset ring-white/[0.06]">
          <span className="absolute left-1/2 top-[3px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-zinc-700 ring-1 ring-zinc-500/40" />

          {/* Screen */}
          <div className="app-surface relative overflow-hidden rounded-[3px] bg-background">
            <div
              ref={ref}
              className="relative w-full"
              style={{ aspectRatio: `${designWidth} / ${designHeight}` }}
            >
              <div
                className="absolute left-0 top-0 flex origin-top-left flex-col"
                style={{
                  width: designWidth,
                  height: designHeight,
                  transform: `scale(${scale})`,
                  // Hidden until measured, so the mock never flashes at full size.
                  visibility: scale ? 'visible' : 'hidden',
                }}
              >
                <BrowserChrome url={url} />
                <div className="min-h-0 flex-1">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Base — wider than the lid, with the notch the lid lifts from */}
      <div className="relative h-[13px]">
        <div className="absolute left-1/2 top-0 h-full w-[105%] -translate-x-1/2 rounded-b-[11px] bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-500 shadow-[0_10px_18px_-8px_rgba(0,0,0,0.35)] dark:from-zinc-600 dark:via-zinc-700 dark:to-zinc-900" />
        <div className="absolute left-1/2 top-0 h-[5px] w-[92px] -translate-x-1/2 rounded-b-[7px] bg-black/15 dark:bg-black/45" />
      </div>
    </div>
  );
}
