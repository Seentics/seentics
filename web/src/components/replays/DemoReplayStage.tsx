'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useT } from '@/lib/i18n';
import { FastForward, Gauge, Maximize2, MousePointer2, Pause, Play, Rewind, SkipForward } from 'lucide-react';

/**
 * A session, playing — for the two places that have no rrweb stream to play.
 *
 * Shared by the landing page's replay preview and `/websites/demo/replays/[id]`.
 * Demo mode has no recorded bytes in object storage, so the detail page used to
 * offer an apology where the player belongs; a visitor evaluating the product got
 * an empty state instead of the feature. This renders what playback looks like:
 * a short visit on a loop — the cursor moves, clicks, the page scrolls, a rage
 * click on "Size guide" — with the seek bar and the clock running.
 *
 * One implementation rather than two, because the landing shot and the demo screen
 * are supposed to be pictures of each other — kept apart they drift.
 *
 * The page inside the viewport is a made-up brand on purpose. The one screen we
 * genuinely cannot know is the visitor's own, and borrowing a real storefront would
 * be a claim about who uses Seentics that we are not entitled to make.
 */

/* ── The visit ─────────────────────────────────────────────────────────────────
   One loop of LOOP_S seconds stands for the whole RECORDING_S-second recording on
   the seek bar. The cursor goes from waypoint to waypoint; each names an element
   of the page (by `data-replay`) or a point of the viewport, so it lands on the
   element whatever size the player is drawn at. */

const LOOP_S = 14;
const RECORDING_S = 192;

type Point = { el: string; dx?: number; dy?: number } | { x: number; y: number };
type Waypoint = { at: number; to: Point; click?: 'click' | 'rage' };

const PATH: Waypoint[] = [
  { at: 0, to: { x: 0.78, y: 0.14 } },
  { at: 1.6, to: { el: 'cta' }, click: 'click' },
  { at: 3.2, to: { x: 0.5, y: 0.62 } },
  { at: 5.2, to: { el: 'product', dy: -6 }, click: 'click' },
  { at: 7.2, to: { el: 'size' } },
  { at: 7.7, to: { el: 'size', dx: 2 }, click: 'rage' },
  { at: 9.8, to: { el: 'cart' }, click: 'click' },
  { at: 12.6, to: { el: 'cart', dx: -40, dy: 30 } },
  { at: LOOP_S, to: { x: 0.78, y: 0.14 } },
];

/** How far down the page is scrolled, in px, through the loop. */
const SCROLL: { at: number; y: number }[] = [
  { at: 0, y: 0 },
  { at: 2.6, y: 0 },
  { at: 4.4, y: 96 },
  { at: 6.2, y: 96 },
  { at: 7.0, y: 0 },
  { at: LOOP_S, y: 0 },
];

/** Where the timeline marks the visit's moments, as a share of the recording. */
const MARKERS = [
  { at: 7.7 / LOOP_S, cls: 'bg-amber-400', label: 'rageClick' as const },
  { at: 10.4 / LOOP_S, cls: 'bg-rose-500', label: 'error' as const },
];

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function interpolate<T extends { at: number }>(frames: readonly T[], t: number): [T, T, number] {
  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i]!;
    const b = frames[i + 1]!;
    if (t >= a.at && t <= b.at) return [a, b, b.at === a.at ? 1 : ease((t - a.at) / (b.at - a.at))];
  }
  const last = frames[frames.length - 1]!;
  return [last, last, 1];
}

/**
 * Drives the loop: one requestAnimationFrame writing styles through refs, so React does not
 * re-render 60 times a second. Runs only while the player is on screen, and not at all for
 * people who asked for less motion — they see the first frame, which is a complete picture.
 */
function usePlayback(refs: {
  root: RefObject<HTMLDivElement | null>;
  scroller: RefObject<HTMLDivElement | null>;
  cursor: RefObject<HTMLDivElement | null>;
  ripples: RefObject<HTMLDivElement | null>;
  rageTag: RefObject<HTMLDivElement | null>;
}, transport: RefObject<{ played: HTMLDivElement | null; knob: HTMLDivElement | null; time: HTMLSpanElement | null }>) {
  useEffect(() => {
    const root = refs.root.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let start = performance.now();
    let last = -1;
    // Playback places the cursor by transform from the corner; the still picture's spot is left/top.
    if (refs.cursor.current) { refs.cursor.current.style.left = '0'; refs.cursor.current.style.top = '0'; }

    const point = (p: Point): { x: number; y: number } => {
      const box = root.getBoundingClientRect();
      if ('x' in p) return { x: p.x * box.width, y: p.y * box.height };
      const el = root.querySelector<HTMLElement>(`[data-replay="${p.el}"]`);
      if (!el) return { x: box.width / 2, y: box.height / 2 };
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2 + (p.dx ?? 0), y: r.top - box.top + r.height / 2 + (p.dy ?? 0) };
    };

    const ripple = (x: number, y: number, kind: 'click' | 'rage') => {
      const host = refs.ripples.current;
      if (!host) return;
      const shots = kind === 'rage' ? [0, 140, 280, 420] : [0];
      for (const delay of shots) {
        window.setTimeout(() => {
          const dot = document.createElement('span');
          dot.className = `seentics-replay-ripple ${kind === 'rage' ? 'is-rage' : ''}`;
          dot.style.left = `${x}px`;
          dot.style.top = `${y}px`;
          host.appendChild(dot);
          window.setTimeout(() => dot.remove(), 700);
        }, delay);
      }
      if (kind === 'rage' && refs.rageTag.current) {
        const tag = refs.rageTag.current;
        tag.style.left = `${x + 14}px`;
        tag.style.top = `${y - 30}px`;
        tag.dataset.on = 'true';
        window.setTimeout(() => { tag.dataset.on = 'false'; }, 1800);
      }
    };

    const frame = (now: number) => {
      const t = ((now - start) / 1000) % LOOP_S;
      if (t < last) refs.ripples.current?.replaceChildren();

      const [sa, sb, sk] = interpolate(SCROLL, t);
      const y = sa.y + (sb.y - sa.y) * sk;
      if (refs.scroller.current) refs.scroller.current.style.transform = `translateY(${-y}px)`;

      const [a, b, k] = interpolate(PATH, t);
      const from = point(a.to);
      const to = point(b.to);
      const cx = from.x + (to.x - from.x) * k;
      const cy = from.y + (to.y - from.y) * k;
      if (refs.cursor.current) refs.cursor.current.style.transform = `translate(${cx}px, ${cy}px)`;

      // A click fires as the cursor arrives at its waypoint.
      for (const w of PATH) if (w.click && last >= 0 && last < w.at && t >= w.at) ripple(cx, cy, w.click);

      const share = t / LOOP_S;
      const tp = transport.current;
      if (tp.played) tp.played.style.width = `${share * 100}%`;
      if (tp.knob) tp.knob.style.left = `${share * 100}%`;
      if (tp.time) tp.time.textContent = clock(share * RECORDING_S);

      last = t;
      raf = requestAnimationFrame(frame);
    };

    const play = () => { if (!raf) { start = performance.now() - Math.max(0, last) * 1000; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const io = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? play() : stop()));
    io.observe(root);
    return () => { io.disconnect(); stop(); };
  }, [refs, transport]);
}

/** The page being replayed, with the visitor's cursor moving over it. */
export function DemoReplayViewport({ transport }: { transport?: RefObject<{ played: HTMLDivElement | null; knob: HTMLDivElement | null; time: HTMLSpanElement | null }> }) {
  const demoT = useT().replays.demo;
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ripples = useRef<HTMLDivElement>(null);
  const rageTag = useRef<HTMLDivElement>(null);
  const noTransport = useRef({ played: null, knob: null, time: null });
  const refs = useRef({ root, scroller, cursor, ripples, rageTag }).current;
  usePlayback(refs, transport ?? noTransport);

  return (
    <div ref={root} className="absolute inset-0 bg-black">
      <style>{`
        .seentics-replay-ripple { position: absolute; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 9999px;
          border: 2px solid rgb(59 130 246 / 0.9); background: rgb(59 130 246 / 0.18); pointer-events: none;
          animation: seentics-replay-ripple 650ms ease-out forwards; }
        .seentics-replay-ripple.is-rage { border-color: rgb(245 158 11 / 0.95); background: rgb(245 158 11 / 0.2); }
        @keyframes seentics-replay-ripple { from { transform: scale(0.35); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
      `}</style>
      {/* The page, scrolled by the recording. Taller than the frame by the most it scrolls,
          so scrolling shows more of the page rather than an empty strip. */}
      <div className="absolute inset-3 overflow-hidden rounded-lg bg-white text-black shadow-inner dark:bg-[#161719] dark:text-white">
        <div ref={scroller} className="flex min-h-[calc(100%+96px)] flex-col will-change-transform">
          {/* Site nav */}
          <div className="flex items-center gap-4 border-b border-black/[0.08] dark:border-white/[0.08] px-5 py-3">
            <span className="text-[13px] font-black tracking-[0.2em] text-black/85 dark:text-white/85">NORTHBOUND</span>
            <div className="flex-1" />
            <span className="text-[10px] font-medium text-black/55 dark:text-white/55">Shop</span>
            <span className="text-[10px] font-medium text-black/55 dark:text-white/55">Journal</span>
            <span className="text-[10px] font-medium text-black/55 dark:text-white/55">About</span>
            <span data-replay="cart" className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold text-white dark:bg-white dark:text-black">Cart · 2</span>
          </div>

          {/*
            Deliberately near-monochrome. This sits inside a player, inside a page — an
            orange eyebrow and gradient panels competed with the product the shot is
            meant to demonstrate. Grey still reads as a real page and leaves the
            player's own controls as the only thing carrying colour.
          */}
          <div className="grid grid-cols-[1.2fr_1fr] gap-6 px-5 py-6">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-black/35 dark:text-white/35">New season</p>
              <p className="mt-1.5 text-[19px] font-extrabold leading-[1.15] tracking-tight text-black/90 dark:text-white/90">
                Built for the
                <br />
                long way round.
              </p>
              <p className="mt-2 max-w-[15rem] text-[10px] leading-relaxed text-black/50 dark:text-white/50">
                Weatherproof packs and layers, made to be repaired rather than replaced.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span data-replay="cta" className="rounded-lg bg-black px-3.5 py-2 text-[10px] font-semibold text-white dark:bg-white dark:text-black">
                  Shop the collection
                </span>
                <span data-replay="size" className="rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 text-[10px] font-semibold text-black/70 dark:text-white/70">
                  Size guide
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-black/[0.07] dark:border-white/[0.07] bg-black/[0.02] dark:bg-white/[0.02] p-3">
              <div className="h-full rounded-lg bg-white p-2.5 dark:bg-[#1c1d20]">
                <div className="h-16 rounded-lg bg-black/[0.07] dark:bg-white/[0.07]" />
                <p className="mt-2 text-[10px] font-semibold text-black/80 dark:text-white/80">Trailhead 32L</p>
                <p className="text-[9px] text-black/45 dark:text-white/45">Recycled ripstop · 3 colours</p>
                <p className="mt-1 text-[11px] font-bold text-black/85 dark:text-white/85">$168</p>
              </div>
            </div>
          </div>

          {/* Product row. A real storefront's thumbnails are photographs, and grey
              stands in for one better than four unrelated hues do. */}
          <div className="grid grid-cols-4 gap-2.5 border-t border-black/[0.06] dark:border-white/[0.06] px-5 py-4">
            {[
              { name: 'Fell Shell', price: '$240' },
              { name: 'Ridge Mid', price: '$185' },
              { name: 'Cairn Vest', price: '$120' },
              { name: 'Moor Cap', price: '$45' },
            ].map((item, i) => (
              <div key={item.name} data-replay={i === 1 ? 'product' : undefined}>
                <div className="h-12 rounded-lg bg-black/[0.07] dark:bg-white/[0.07]" />
                <p className="mt-1.5 text-[9px] font-semibold text-black/75 dark:text-white/75">{item.name}</p>
                <p className="text-[9px] font-bold text-black/50 dark:text-white/50">{item.price}</p>
              </div>
            ))}
          </div>

          {/* Footer band, so the page reaches the bottom of the frame however tall it is. */}
          <div className="mt-auto grid grid-cols-[1.4fr_1fr_1fr] gap-6 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.015] dark:bg-white/[0.015] px-5 py-5">
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-black/70 dark:text-white/70">NORTHBOUND</p>
              <p className="mt-1.5 max-w-[16rem] text-[9px] leading-relaxed text-black/45 dark:text-white/45">
                Repairs are free for the life of the product. Returns within 60 days, no questions.
              </p>
            </div>
            {[
              { head: 'Shop', links: ['Packs', 'Layers', 'Accessories'] },
              { head: 'Company', links: ['Our repairs', 'Stockists', 'Contact'] },
            ].map((col) => (
              <div key={col.head}>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">{col.head}</p>
                <div className="mt-1.5 space-y-1">
                  {col.links.map((l) => (
                    <p key={l} className="text-[9px] text-black/55 dark:text-white/55">{l}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Click marks, the rage-click tag and the cursor, over the page. */}
      <div ref={ripples} className="pointer-events-none absolute inset-0" aria-hidden />
      <div
        ref={rageTag}
        data-on="false"
        className="pointer-events-none absolute left-0 top-0 rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-black opacity-0 shadow transition-opacity duration-200 data-[on=true]:opacity-100"
        aria-hidden
      >
        {demoT.rageClick}
      </div>
      {/* Where the recording has the cursor; the still picture's spot until playback moves it. */}
      <div ref={cursor} className="pointer-events-none absolute left-[24%] top-[57%] will-change-transform" aria-hidden>
        <MousePointer2 className="relative -ml-[3px] -mt-[2px] h-5 w-5 fill-white text-black/70 drop-shadow" />
      </div>
    </div>
  );
}

type TransportRefs = { played: HTMLDivElement | null; knob: HTMLDivElement | null; time: HTMLSpanElement | null };

/** Play / seek / speed / fullscreen — always dark, as under the real player. */
export function DemoTransportBar({ transport }: { transport?: RefObject<TransportRefs> }) {
  const t = useT().replays.demo;
  return (
    <div className="w-full shrink-0 border-t border-zinc-800/80 bg-zinc-900/90 px-3 py-2">
      <div className="flex min-h-[2.25rem] items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500">
          <Rewind className="h-3.5 w-3.5" />
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          {/* Playing: pause is the control on offer. Without motion nothing plays, so play. */}
          <Pause className="hidden h-3.5 w-3.5 fill-current motion-safe:block" />
          <Play className="h-3.5 w-3.5 translate-x-px fill-current motion-safe:hidden" />
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500">
          <FastForward className="h-3.5 w-3.5" />
        </span>

        {/* Seek track, with the visit's moments marked on it */}
        <div className="relative mx-1 flex h-4 min-w-0 flex-1 items-center">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-700/50" />
          <div
            ref={(el) => { if (transport) transport.current.played = el; }}
            className="absolute left-0 top-1/2 h-2 w-[46%] -translate-y-1/2 rounded-full bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.12)]"
          />
          {MARKERS.map((m) => (
            <span
              key={m.label}
              title={t[m.label]}
              className={`absolute top-1/2 h-2 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${m.cls}`}
              style={{ left: `${m.at * 100}%` }}
            />
          ))}
          <div
            ref={(el) => { if (transport) transport.current.knob = el; }}
            className="absolute left-[46%] top-1/2 h-3.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-900 bg-white shadow-sm"
          />
        </div>

        <span className="shrink-0 text-right text-[11px] tabular-nums">
          <span ref={(el) => { if (transport) transport.current.time = el; }} className="font-medium text-zinc-200">1:28</span>
          <span className="mx-0.5 text-zinc-600">/</span>
          <span className="text-zinc-500">{clock(RECORDING_S)}</span>
        </span>

        <div className="flex shrink-0 items-center gap-1 border-l border-zinc-800/80 pl-2">
          <SkipForward className="h-3.5 w-3.5 text-zinc-300" />
          <span className="flex items-center gap-0.5 text-[11px] font-medium tabular-nums text-zinc-500">
            <Gauge className="h-3 w-3 opacity-80" />1×
          </span>
          <Maximize2 className="h-3.5 w-3.5 text-zinc-500" />
        </div>
      </div>
    </div>
  );
}

/** Viewport plus transport bar — the whole player, at whatever width it is given. */
export function DemoReplayPlayer() {
  const transport = useRef<TransportRefs>({ played: null, knob: null, time: null });
  return (
    <div className="mb-4 w-full overflow-hidden rounded-lg border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">
      <div
        className="relative w-full overflow-hidden rounded-t-xl bg-black outline outline-1 -outline-offset-1 outline-white/[0.06]"
        style={{ aspectRatio: '16/9' }}
      >
        <DemoReplayViewport transport={transport} />
      </div>
      <DemoTransportBar transport={transport} />
    </div>
  );
}
