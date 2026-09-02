import {
  ArrowLeft,
  Copy,
  FastForward,
  Gauge,
  Maximize2,
  MousePointer2,
  Play,
  Rewind,
  SkipForward,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MockSidebar } from './MockSidebar';

/**
 * A session replay, playing.
 *
 * Mirrors `app/websites/[websiteId]/replays/[sessionId]/` — the header row with the
 * mono session id, the 16:9 black player with its zinc-900 transport bar, and the
 * tabbed sidebar (Summary / Timeline / Errors / Console / Network) with the badge
 * counts the real tabs carry.
 *
 * The viewport holds a wireframe of the page being replayed rather than a real
 * recording: rrweb needs an event stream and an iframe, and neither belongs on a
 * landing page. The wireframe is deliberately generic — it stands in for "the
 * visitor's own site", which is the one screen we cannot know.
 */

const TABS = [
  { label: 'Summary' },
  { label: 'Timeline' },
  { label: 'Errors', badge: '1', badgeCls: 'text-red-400' },
  { label: 'Console', badge: '2', badgeCls: 'text-amber-400' },
  { label: 'Network' },
];

const SUMMARY = [
  { label: 'Browser', value: 'Chrome' },
  { label: 'Device / OS', value: 'Desktop · macOS' },
  { label: 'Country', value: 'United States' },
  { label: 'Entry page', value: '/pricing', mono: true },
  { label: 'Exit page', value: '/checkout/success', mono: true },
  { label: 'Started', value: 'Today at 2:41 PM' },
];

/**
 * The page being replayed.
 *
 * Grey placeholder bars were the first attempt and they read as a loading skeleton,
 * not a recording — which undercut the whole point of the shot. So this is a real
 * (if invented) storefront: a made-up brand, because the one screen we genuinely
 * cannot know is the visitor's own, and borrowing a real one would be a lie about
 * who uses the product.
 */
function ReplayedPage() {
  return (
    <div className="absolute inset-0 bg-black">
      <div className="absolute inset-3 overflow-hidden rounded-lg bg-white text-black shadow-inner">
        {/* Site nav */}
        <div className="flex items-center gap-4 border-b border-black/[0.08] px-5 py-3">
          <span className="text-[13px] font-black tracking-[0.2em] text-black/85">NORTHBOUND</span>
          <div className="flex-1" />
          <span className="text-[10px] font-medium text-black/55">Shop</span>
          <span className="text-[10px] font-medium text-black/55">Journal</span>
          <span className="text-[10px] font-medium text-black/55">About</span>
          <span className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold text-white">Cart · 2</span>
        </div>

        <div className="grid grid-cols-[1.15fr_1fr] gap-5 px-5 py-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-orange-600">New season</p>
            <p className="mt-1.5 text-[19px] font-extrabold leading-[1.15] tracking-tight text-black/90">
              Built for the
              <br />
              long way round.
            </p>
            <p className="mt-2 max-w-[15rem] text-[10px] leading-relaxed text-black/55">
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

          <div className="rounded-lg bg-gradient-to-br from-orange-100 via-amber-50 to-sky-100 p-3">
            <div className="h-full rounded-lg border border-black/[0.06] bg-white/70 p-2.5">
              <div className="h-16 rounded-lg bg-gradient-to-br from-stone-300 to-stone-400/70" />
              <p className="mt-2 text-[10px] font-semibold text-black/80">Trailhead 32L</p>
              <p className="text-[9px] text-black/50">Recycled ripstop · 3 colours</p>
              <p className="mt-1 text-[11px] font-bold text-black/85">$168</p>
            </div>
          </div>
        </div>

        {/* Product row */}
        <div className="grid grid-cols-4 gap-2.5 border-t border-black/[0.06] px-5 py-4">
          {[
            { name: 'Fell Shell', price: '$240', tint: 'from-emerald-200 to-emerald-400/60' },
            { name: 'Ridge Mid', price: '$185', tint: 'from-sky-200 to-sky-400/60' },
            { name: 'Cairn Vest', price: '$120', tint: 'from-amber-200 to-amber-400/60' },
            { name: 'Moor Cap', price: '$45', tint: 'from-rose-200 to-rose-400/60' },
          ].map((item) => (
            <div key={item.name}>
              <div className={cn('h-12 rounded-lg bg-gradient-to-br', item.tint)} />
              <p className="mt-1.5 text-[9px] font-semibold text-black/75">{item.name}</p>
              <p className="text-[9px] font-bold text-black/55">{item.price}</p>
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
function TransportBar() {
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

export function ReplayMock() {
  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <MockSidebar active="Recording" />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="w-full shrink-0 border-b border-border">
          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 px-5 py-2">
            <span className="flex h-8 shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Replays
            </span>
            <div className="h-4 w-px shrink-0 bg-border/50" />
            <Video className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-sm font-semibold text-foreground">
                sess_8f2c41ab9de07
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground">
                <Copy className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex-1" />
            <Badge
              variant="outline"
              className="shrink-0 border-red-500/50 bg-red-500/10 text-[10px] text-red-800 dark:text-red-300"
            >
              Client errors
            </Badge>
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-800 dark:text-amber-300"
            >
              Rage clicks
            </Badge>
          </div>
        </div>

        {/* Player */}
        <div className="w-full shrink-0 px-5 pt-4">
          {/* Full width. It was capped at 620px to leave room for the summary card
              below, but that put an empty margin down both sides of the one thing the
              section is about. A 16:9 player at full width is taller, so the summary
              is mostly below the screen edge now — which reads as a page continuing
              rather than as a gap. */}
          <div className="mb-4 w-full overflow-hidden rounded-lg border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">
            <div
              className="relative w-full overflow-hidden rounded-t-xl bg-black outline outline-1 -outline-offset-1 outline-white/[0.06]"
              style={{ aspectRatio: '16/9' }}
            >
              <ReplayedPage />
            </div>
            <TransportBar />
          </div>
        </div>

        {/* Tabbed sidebar */}
        <section className="min-h-0 flex-1 border-t border-border bg-background/60">
          <div className="border-b border-border bg-background/80 px-5">
            <div className="flex w-full items-center gap-0">
              {TABS.map((t, i) => (
                <span
                  key={t.label}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium',
                    i === 0 ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
                  )}
                >
                  {t.label}
                  {t.badge && (
                    <span className={cn('text-[10px] font-semibold tabular-nums', t.badgeCls)}>{t.badge}</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="px-5 py-4">
            <Card className="rounded-lg shadow-sm">
              <CardHeader className="space-y-0.5 pb-4">
                <p className="text-sm font-semibold text-foreground">Session summary</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Who this was, where they started, and how long the recording runs.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <dl className="space-y-3">
                  {SUMMARY.map((f) => (
                    <div key={f.label} className="grid grid-cols-[9.5rem_1fr] gap-x-4">
                      <dt className="pt-0.5 text-xs text-muted-foreground">{f.label}</dt>
                      <dd
                        className={cn(
                          'min-w-0 text-sm font-medium text-foreground',
                          f.mono && 'font-mono text-xs',
                        )}
                      >
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
