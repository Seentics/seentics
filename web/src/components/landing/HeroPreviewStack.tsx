'use client';

import { useState } from 'react';
import {
  Globe,
  ChevronDown,
  Play,
  Maximize2,
  MessageSquare,
  Rewind,
  FastForward,
  SkipForward,
  Gauge,
  Monitor,
  MousePointer2,
  MousePointerClick,
  ZoomIn,
  ZoomOut,
  GripVertical,
  LogOut,
  Clock,
} from 'lucide-react';
import HeroDashboardPreview from './HeroDashboardPreview';
import { cn } from '@/lib/utils';

/* ========================================================================== */
/* Panel — Automation builder                                                */
/*                                                                            */
/* Mirrors src/components/automations/AutomationBuilder.tsx and its           */
/* nodes/CustomNodes.tsx. Kept deliberately close to the real markup — same    */
/* node widths, border treatment, palette layout and toolbar position — so the */
/* hero shows the product rather than an impression of it. The real builder    */
/* uses custom pan/zoom, not ReactFlow's <Controls>/<Background>, so there is  */
/* no control stack here either.                                              */
/* ========================================================================== */

/**
 * A trigger or action node.
 *
 * Borders are neutral (`border-border/60`) because that is what an unselected node
 * looks like in the builder; only selection tints them. The kind is signalled by the
 * icon tile and the uppercase eyebrow, exactly as in CustomNodes.
 */
function BuilderNode({
  kind,
  icon: Icon,
  label,
  sub,
}: {
  kind: 'trigger' | 'action';
  icon: typeof Globe;
  label: string;
  sub?: string;
}) {
  const isTrigger = kind === 'trigger';
  return (
    <div className="relative min-w-[220px] rounded-lg border-2 border-border/60 bg-card px-4 py-3 shadow-sm">
      {/* Target handle — actions accept an incoming edge, triggers start the flow. */}
      {!isTrigger && (
        <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-4 border-background bg-indigo-500" />
      )}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isTrigger ? 'bg-primary/10 text-primary' : 'bg-indigo-500/10 text-indigo-500',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              'mb-0.5 text-[10px] font-bold uppercase tracking-wider',
              isTrigger ? 'text-primary' : 'text-indigo-500',
            )}
          >
            {isTrigger ? 'Trigger' : 'Action'}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          {sub && (
            <p
              className={cn(
                'mt-1 text-[11px] leading-snug text-muted-foreground',
                isTrigger ? 'truncate font-mono' : 'line-clamp-2',
              )}
            >
              {sub}
            </p>
          )}
        </div>
      </div>
      {/* Source handle. Dimmed on actions in the real builder until hovered. */}
      <span
        className={cn(
          'absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-4 border-background',
          isTrigger ? 'bg-primary' : 'bg-indigo-500 opacity-40',
        )}
        aria-hidden
      />
    </div>
  );
}

/**
 * The condition node — the builder's branching primitive.
 *
 * Absent from the previous preview, which made the hero look like a linear
 * trigger-then-actions tool. Amber, wider padding, and two labelled outputs.
 */
function ConditionNode({ label }: { label: string }) {
  return (
    <div className="relative min-w-[180px] rounded-lg border-2 border-border/60 bg-card px-5 py-4 shadow-sm">
      <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-4 border-background bg-amber-500" />
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Condition</p>
      <p className="text-sm font-bold leading-tight text-foreground">{label}</p>

      <span className="absolute -bottom-2 left-[30%] h-4 w-4 -translate-x-1/2 rounded-full border-4 border-background bg-emerald-500" />
      <span className="absolute -bottom-5 left-[30%] -translate-x-1/2 text-[9px] font-black uppercase text-emerald-600">
        Yes
      </span>
      <span className="absolute -bottom-2 left-[70%] h-4 w-4 -translate-x-1/2 rounded-full border-4 border-background bg-rose-500" />
      <span className="absolute -bottom-5 left-[70%] -translate-x-1/2 text-[9px] font-black uppercase text-rose-600">
        No
      </span>
    </div>
  );
}

function Connector({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn('h-4 w-0.5', color)} />
      <ChevronDown className="-my-1 h-3.5 w-3.5 text-muted-foreground" />
      <div className={cn('h-4 w-0.5', color)} />
    </div>
  );
}

/** One palette row. Mirrors `PaletteRow` — icon tile, label, hint, grip. */
function PaletteRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  hint,
}: {
  icon: typeof Globe;
  iconBg: string;
  iconColor: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 shadow-sm">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/30" />
    </div>
  );
}

function AutomationsPanel() {
  return (
    <div className="flex h-full bg-background">
      {/* Canvas — dotted background, as the builder renders it. */}
      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {/* Zoom toolbar — top centre, with the percentage readout the builder shows. */}
        <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-card/95 px-2 py-1.5 shadow-2xl backdrop-blur">
          <span className="flex h-8 w-8 items-center justify-center text-muted-foreground">
            <ZoomIn className="h-4 w-4" />
          </span>
          <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">100%</span>
          <span className="flex h-8 w-8 items-center justify-center text-muted-foreground">
            <ZoomOut className="h-4 w-4" />
          </span>
          <span className="mx-1 h-4 w-px bg-muted" />
          <span className="flex h-8 w-8 items-center justify-center text-muted-foreground">
            <Maximize2 className="h-4 w-4" />
          </span>
        </div>

        <div className="flex h-full flex-col items-center justify-center py-4">
          <BuilderNode kind="trigger" icon={Globe} label="Page View" sub="/pricing" />
          <Connector color="bg-border" />
          <ConditionNode label="Returning visitor?" />
          <Connector color="bg-border" />
          <BuilderNode kind="action" icon={MessageSquare} label="Show Popup" sub="Discount offer, bottom-right" />
        </div>
      </div>

      {/* Node palette — the builder's right aside. */}
      <aside className="hidden w-[280px] shrink-0 flex-col overflow-hidden border-l border-border/60 bg-card lg:flex xl:w-[320px]">
        <div className="shrink-0 border-b border-border/60 p-4">
          <h3 className="text-sm font-semibold text-foreground">Add a node</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Drag onto the canvas, or click to add.</p>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <span className="rounded-lg bg-background py-1.5 text-center text-xs font-semibold capitalize text-foreground shadow-sm">
              triggers
            </span>
            <span className="rounded-lg py-1.5 text-center text-xs font-semibold capitalize text-muted-foreground">
              actions
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
          <PaletteRow
            icon={Globe}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            label="Page View"
            hint="Triggers when a user visits a specific page"
          />
          <PaletteRow
            icon={LogOut}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            label="Exit Intent"
            hint="Triggers when a user is about to leave"
          />
          <PaletteRow
            icon={Clock}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            label="Time on Page"
            hint="Triggers after a user spends time on page"
          />
        </div>
      </aside>
    </div>
  );
}

/* Panel — Session replay player + tabbed sidebar                            */
/* ========================================================================== */

const REPLAY_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'errors', label: 'Errors', badge: '1', badgeCls: 'text-red-400' },
  { id: 'console', label: 'Console', badge: '2', badgeCls: 'text-amber-400' },
  { id: 'network', label: 'Network' },
];

const SESSION_SUMMARY = [
  { label: 'Browser', value: 'Chrome 121' },
  { label: 'Device / OS', value: 'Desktop · macOS' },
  { label: 'Country', value: 'United States' },
  { label: 'Entry page', value: '/pricing', mono: true },
  { label: 'Recording length', value: '3m 12s' },
  { label: 'Pages viewed', value: '4' },
];

function ReplayPanel() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Player card — capped width so the tab bar below always stays visible */}
      <div className="mx-auto w-full max-w-xl p-3">
        <div className="overflow-hidden rounded-lg border border-border/60 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">
          {/* Viewport (always dark, like the real player) */}
          <div className="relative aspect-[16/9] overflow-hidden bg-black">
            <div className="absolute inset-3 rounded-lg bg-white/95 p-3 shadow-inner">
              <div className="flex items-center gap-1.5 border-b border-black/10 pb-2">
                <div className="h-2 w-2 rounded-full bg-black/20" />
                <div className="h-1.5 w-20 rounded-full bg-black/10" />
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-2.5 w-3/4 rounded-full bg-black/15" />
                <div className="h-2.5 w-1/2 rounded-full bg-black/10" />
                <div className="mt-3 h-6 w-24 rounded-lg bg-primary/80" />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="h-9 rounded-lg bg-black/[0.06]" />
                  <div className="h-9 rounded-lg bg-black/[0.06]" />
                  <div className="h-9 rounded-lg bg-black/[0.06]" />
                </div>
              </div>
            </div>
            <div className="absolute left-[56%] top-[62%]">
              <span className="absolute -inset-2 animate-ping rounded-full bg-primary/40" />
              <MousePointer2 className="relative h-4 w-4 fill-white text-white drop-shadow" />
            </div>
          </div>

          {/* Transport bar */}
          <div className="border-t border-zinc-800/80 bg-zinc-900/90 px-3 py-2">
            <div className="flex items-center gap-2">
              <Rewind className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
              </div>
              <FastForward className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <div className="relative mx-1 h-2 min-w-0 flex-1">
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-700/50" />
                <div className="absolute left-0 top-1/2 h-2 w-[46%] -translate-y-1/2 rounded-full bg-white/85" />
                <div className="absolute left-[46%] top-1/2 h-3.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-900 bg-white" />
              </div>
              <span className="shrink-0 text-right text-[11px] tabular-nums">
                <span className="font-medium text-zinc-200">1:28</span>
                <span className="mx-0.5 text-zinc-600">/</span>
                <span className="text-zinc-500">3:12</span>
              </span>
              <div className="flex shrink-0 items-center gap-1 border-l border-zinc-800/80 pl-1.5">
                <SkipForward className="h-3.5 w-3.5 text-zinc-300" />
                <span className="flex items-center gap-0.5 text-[11px] font-medium tabular-nums text-zinc-500">
                  <Gauge className="h-3 w-3 opacity-80" />1×
                </span>
                <Maximize2 className="h-3.5 w-3.5 text-zinc-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed sidebar — replicates ReplaySessionSidebar */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-border/60 bg-background/60">
        <div className="flex items-center gap-0 overflow-x-auto border-b border-border/60 bg-background/80 px-2">
          {REPLAY_TABS.map((t) => (
            <span
              key={t.id}
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2.5 py-2 text-[11px] font-medium ${
                t.id === 'summary'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {t.label}
              {t.badge && <span className={`text-[10px] font-semibold tabular-nums ${t.badgeCls}`}>{t.badge}</span>}
            </span>
          ))}
        </div>

        {/* Summary tab content */}
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <div className="rounded-lg border border-border/60 bg-card p-3 shadow-sm">
            <p className="mb-2.5 text-xs font-semibold text-foreground">Session summary</p>
            <dl className="space-y-2">
              {SESSION_SUMMARY.map((f) => (
                <div key={f.label} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-3">
                  <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
                  <dd className={`min-w-0 truncate text-[11px] font-medium text-foreground ${f.mono ? 'font-mono' : ''}`}>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Section — three squared mocks, each 1/3 width                             */
/* ========================================================================== */

const PANELS = [
  { key: 'analytics', label: 'Analytics', node: <HeroDashboardPreview /> },
  { key: 'replay', label: 'Session Replay', node: <ReplayPanel /> },
  { key: 'automations', label: 'Automation Builder', node: <AutomationsPanel /> },
];

// Cascade SLOTS by stacking rank (desktop). Rank 0 is the front/top slot (narrowest,
// fully visible); the wider slots sit lower and behind so their bottom edges peek out,
// making the hierarchy clear. Clicking a layer moves it into the front slot and the
// others slide back into the remaining slots.
/**
 * The cascade, front to back.
 *
 * `dim` and `sat` are what create depth. Every inactive layer used to share one
 * brightness value, so the second and third read as a single dark mass behind the
 * front one rather than as a stack. Stepping both brightness and saturation gives
 * three distinct planes: the active layer at full colour, then progressively greyer
 * and flatter as they recede — the same cue a real stack of paper gives.
 */
const SLOTS = [
  { w: 80, ty: 0, z: 40, sc: 1.02, dim: 1, sat: 1 }, // front / active — untouched
  { w: 90, ty: 52, z: 20, sc: 1, dim: 0.82, sat: 0.7 },
  { w: 100, ty: 104, z: 10, sc: 1, dim: 0.66, sat: 0.45 },
];

export default function HeroPreviewStack() {
  // Click-driven (not hover) so there is no resize-under-cursor flicker. Default: first
  // layer at the front. Clicking another reorders it to the front slot.
  const [active, setActive] = useState(0);
  const inactive = PANELS.map((_, idx) => idx).filter((idx) => idx !== active);

  return (
    <div className="relative md:h-[760px]">
      {/* Mobile tab switcher — the desktop cascade/click interaction needs pointer + space,
          so on small screens we show one preview at a time with tabs. */}
      <div className="mb-4 grid grid-cols-3 gap-2 md:hidden">
        {PANELS.map((p, i) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className={cn(
              'rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors',
              active === i
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 bg-card text-muted-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {PANELS.map((p, i) => {
        const rank = i === active ? 0 : inactive.indexOf(i) + 1; // 0 = front
        const slot = SLOTS[rank];
        const isActive = rank === 0;
        return (
          <div
            key={p.key}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(i);
              }
            }}
            style={{
              ['--w' as string]: `${slot.w}%`,
              ['--ty' as string]: `${slot.ty}px`,
              ['--z' as string]: slot.z,
              ['--sc' as string]: slot.sc,
              ['--dim' as string]: slot.dim,
              ['--sat' as string]: slot.sat,
            }}
            className={cn(
              'group relative h-[420px] w-full overflow-hidden rounded-lg border border-border/60 bg-card outline-none sm:h-[480px]',
              'shadow-[0_30px_60px_-12px_rgba(0,0,0,0.4),0_12px_24px_-8px_rgba(0,0,0,0.25)]',
              'transition-all duration-500 ease-out md:cursor-pointer',
              // Mobile: only the selected preview is shown (tabs switch it).
              i !== active && 'hidden md:block',
              // Desktop: slot-based cascade — width, offset, z and scale come from the slot,
              // so activating a layer animates every layer to its new slot.
              'md:absolute md:left-1/2 md:top-0 md:h-[600px] md:[width:var(--w)] md:[transform:translateX(-50%)_translateY(var(--ty))_scale(var(--sc))] md:[z-index:var(--z)]',
              // Depth: the front layer keeps full colour and the deepest shadow; the
              // ones behind step down in brightness, saturation and shadow together.
              'md:[filter:brightness(var(--dim))_saturate(var(--sat))]',
              isActive
                ? 'md:shadow-[0_45px_90px_-18px_rgba(0,0,0,0.55)] md:shadow-primary/10'
                : rank === 1
                  ? 'md:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.35)]'
                  : 'md:shadow-[0_14px_28px_-14px_rgba(0,0,0,0.25)]',
              'md:focus-visible:ring-2 md:focus-visible:ring-primary/50',
            )}
          >
            {p.node}

            {/* Corner label — desktop only (mobile uses the tab bar) */}
            <span className="pointer-events-none absolute left-3 top-3 z-20 hidden rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur md:block">
              {p.label}
            </span>

            {/* Hover cue — prompt to click (desktop, non-front layers) */}
            {!isActive && (
              <span className="pointer-events-none absolute left-1/2 bottom-3 z-30 hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-foreground/90 px-3 py-1.5 text-[11px] font-semibold text-background opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 md:flex md:group-hover:opacity-100">
                <MousePointerClick className="h-3.5 w-3.5" />
                Click to bring to front
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
