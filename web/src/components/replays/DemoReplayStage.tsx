import { FastForward, Gauge, Maximize2, MousePointer2, Play, Rewind, SkipForward } from 'lucide-react';

/**
 * A session, playing — for the two places that have no rrweb stream to play.
 *
 * Shared by the landing page's replay preview and `/websites/demo/replays/[id]`.
 * Demo mode has no recorded bytes in object storage, so the detail page used to
 * offer an apology where the player belongs; a visitor evaluating the product got
 * an empty state instead of the feature. This renders what playback looks like.
 *
 * One implementation rather than two, because the landing shot and the demo screen
 * are supposed to be pictures of each other — kept apart they drift.
 *
 * The page inside the viewport is a made-up brand on purpose. The one screen we
 * genuinely cannot know is the visitor's own, and borrowing a real storefront would
 * be a claim about who uses Seentics that we are not entitled to make.
 */

/** The page being replayed, with the cursor where the recording has it. */
export function DemoReplayViewport() {
  return (
    <div className="absolute inset-0 bg-black">
      {/* Flex column so the footer can take `mt-auto` and sit at the bottom of
          however tall the frame turns out to be. */}
      <div className="absolute inset-3 flex flex-col overflow-hidden rounded-lg bg-white text-black shadow-inner">
        {/* Site nav */}
        <div className="flex items-center gap-4 border-b border-black/[0.08] px-5 py-3">
          <span className="text-[13px] font-black tracking-[0.2em] text-black/85">NORTHBOUND</span>
          <div className="flex-1" />
          <span className="text-[10px] font-medium text-black/55">Shop</span>
          <span className="text-[10px] font-medium text-black/55">Journal</span>
          <span className="text-[10px] font-medium text-black/55">About</span>
          <span className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold text-white">Cart · 2</span>
        </div>

        {/*
          Deliberately near-monochrome. This sits inside a player, inside a page — an
          orange eyebrow and gradient panels competed with the product the shot is
          meant to demonstrate. Grey still reads as a real page and leaves the
          player's own controls as the only thing carrying colour.
        */}
        <div className="grid grid-cols-[1.2fr_1fr] gap-6 px-5 py-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-black/35">New season</p>
            <p className="mt-1.5 text-[19px] font-extrabold leading-[1.15] tracking-tight text-black/90">
              Built for the
              <br />
              long way round.
            </p>
            <p className="mt-2 max-w-[15rem] text-[10px] leading-relaxed text-black/50">
              Weatherproof packs and layers, made to be repaired rather than replaced.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="rounded-lg bg-black px-3.5 py-2 text-[10px] font-semibold text-white">
                Shop the collection
              </span>
              <span className="rounded-lg border border-black/15 px-3 py-2 text-[10px] font-semibold text-black/70">
                Size guide
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-black/[0.07] bg-black/[0.02] p-3">
            <div className="h-full rounded-lg bg-white p-2.5">
              <div className="h-16 rounded-lg bg-black/[0.07]" />
              <p className="mt-2 text-[10px] font-semibold text-black/80">Trailhead 32L</p>
              <p className="text-[9px] text-black/45">Recycled ripstop · 3 colours</p>
              <p className="mt-1 text-[11px] font-bold text-black/85">$168</p>
            </div>
          </div>
        </div>

        {/* Product row. A real storefront's thumbnails are photographs, and grey
            stands in for one better than four unrelated hues do. */}
        <div className="grid grid-cols-4 gap-2.5 border-t border-black/[0.06] px-5 py-4">
          {[
            { name: 'Fell Shell', price: '$240' },
            { name: 'Ridge Mid', price: '$185' },
            { name: 'Cairn Vest', price: '$120' },
            { name: 'Moor Cap', price: '$45' },
          ].map((item) => (
            <div key={item.name}>
              <div className="h-12 rounded-lg bg-black/[0.07]" />
              <p className="mt-1.5 text-[9px] font-semibold text-black/75">{item.name}</p>
              <p className="text-[9px] font-bold text-black/50">{item.price}</p>
            </div>
          ))}
        </div>

        {/*
          Footer band, so the page fills the frame.

          The player is 16:9 at whatever width its column gives it, and on a wide
          dashboard column that is tall — taller than the storefront above needs. With
          nothing here the recording ended in 200px of blank white, which reads as a
          rendering fault rather than as the bottom of a page.
        */}
        <div className="mt-auto grid grid-cols-[1.4fr_1fr_1fr] gap-6 border-t border-black/[0.06] bg-black/[0.015] px-5 py-5">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-black/70">NORTHBOUND</p>
            <p className="mt-1.5 max-w-[16rem] text-[9px] leading-relaxed text-black/45">
              Repairs are free for the life of the product. Returns within 60 days, no questions.
            </p>
          </div>
          {[
            { head: 'Shop', links: ['Packs', 'Layers', 'Accessories'] },
            { head: 'Company', links: ['Our repairs', 'Stockists', 'Contact'] },
          ].map((col) => (
            <div key={col.head}>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-black/45">{col.head}</p>
              <div className="mt-1.5 space-y-1">
                {col.links.map((l) => (
                  <p key={l} className="text-[9px] text-black/55">{l}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The visitor's cursor, where the recording has it right now. */}
      <div className="absolute left-[24%] top-[57%]">
        <span className="absolute -inset-2 animate-ping rounded-full bg-primary/40" />
        <MousePointer2 className="relative h-5 w-5 fill-white text-white drop-shadow" />
      </div>
    </div>
  );
}

/** Play / seek / speed / fullscreen — always dark, as under the real player. */
export function DemoTransportBar() {
  return (
    <div className="w-full shrink-0 border-t border-zinc-800/80 bg-zinc-900/90 px-3 py-2">
      <div className="flex min-h-[2.25rem] items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500">
          <Rewind className="h-3.5 w-3.5" />
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500">
          <FastForward className="h-3.5 w-3.5" />
        </span>

        {/* Seek track */}
        <div className="relative mx-1 flex h-4 min-w-0 flex-1 items-center">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-700/50" />
          <div className="absolute left-0 top-1/2 h-2 w-[46%] -translate-y-1/2 rounded-full bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.12)]" />
          <div className="absolute left-[46%] top-1/2 h-3.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-900 bg-white shadow-sm" />
        </div>

        <span className="shrink-0 text-right text-[11px] tabular-nums">
          <span className="font-medium text-zinc-200">1:28</span>
          <span className="mx-0.5 text-zinc-600">/</span>
          <span className="text-zinc-500">3:12</span>
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
  return (
    <div className="mb-4 w-full overflow-hidden rounded-lg border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">
      <div
        className="relative w-full overflow-hidden rounded-t-xl bg-black outline outline-1 -outline-offset-1 outline-white/[0.06]"
        style={{ aspectRatio: '16/9' }}
      >
        <DemoReplayViewport />
      </div>
      <DemoTransportBar />
    </div>
  );
}
