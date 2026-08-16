'use client';

import { useState } from 'react';
import {
  Globe,
  ChevronDown,
  Play,
  Plus,
  Search,
  Maximize2,
  MessageSquare,
  Mail,
  Trash2,
  Rewind,
  FastForward,
  SkipForward,
  Gauge,
  Monitor,
  MousePointer2,
  MousePointerClick,
  Minus,
  Frame,
} from 'lucide-react';
import HeroDashboardPreview from './HeroDashboardPreview';
import { cn } from '@/lib/utils';

/* ========================================================================== */
/* Panel — Automation builder (ReactFlow replica)                            */
/* ========================================================================== */

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
    <div
      className={`relative w-[190px] rounded-lg border-2 bg-card px-4 py-3 shadow-sm ${
        isTrigger ? 'border-primary/50' : 'border-indigo-500/50'
      }`}
    >
      {!isTrigger && (
        <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-lg-full border-4 border-background bg-indigo-500" />
      )}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isTrigger ? 'bg-primary/10 text-primary' : 'bg-indigo-500/10 text-indigo-500'
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p
            className={`mb-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isTrigger ? 'text-primary' : 'text-indigo-500'
            }`}
          >
            {isTrigger ? 'Trigger' : 'Action'}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
          {sub && <p className="mt-0.5 truncate font-mono text-[11px] leading-snug text-muted-foreground">{sub}</p>}
        </div>
      </div>
      <span
        className={`absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-lg-full border-4 border-background ${
          isTrigger ? 'bg-primary' : 'bg-indigo-500'
        }`}
      />
    </div>
  );
}

function Connector({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`h-4 w-0.5 ${color}`} />
      <ChevronDown className="-my-1 h-3.5 w-3.5 text-muted-foreground" />
      <div className={`h-4 w-0.5 ${color}`} />
    </div>
  );
}

function AutomationsPanel() {
  return (
    <div className="flex h-full bg-background">
      {/* Canvas */}
      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        <div className="flex h-full flex-col items-center justify-center py-4">
          <BuilderNode kind="trigger" icon={Globe} label="Page View" sub="/pricing" />
          <Connector color="bg-primary/50" />
          <BuilderNode kind="action" icon={MessageSquare} label="Show Popup" />
          <Connector color="bg-indigo-500/50" />
          <BuilderNode kind="action" icon={Mail} label="Send Email" />
        </div>

        {/* ReactFlow Controls — bottom-left */}
        <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card/95 shadow-lg backdrop-blur-sm">
          {[Plus, Minus, Frame, Maximize2].map((Ic, i) => (
            <div key={i} className={`flex h-6 w-6 items-center justify-center ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <Ic className="h-3 w-3 text-muted-foreground" />
            </div>
          ))}
        </div>

        {/* Floating action toolbar — bottom-center */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-lg-2xl border border-border/60 bg-card/90 p-1.5 shadow-xl backdrop-blur-md">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-muted-foreground">
            <Maximize2 className="h-3.5 w-3.5" /> Fit
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-foreground">
            <Play className="h-3.5 w-3.5" /> Test
          </span>
        </div>
      </div>

      {/* Node palette — right side, matches real builder */}
      <aside className="hidden w-32 shrink-0 flex-col border-l border-border bg-muted/30 lg:flex">
        <div className="shrink-0 space-y-2 border-b border-border px-2.5 py-2.5">
          <div>
            <p className="text-[11px] font-medium text-foreground">Nodes</p>
            <p className="text-[9px] text-muted-foreground">Drag onto the canvas</p>
          </div>
          <div className="relative flex h-7 items-center gap-1.5 rounded-lg border border-input bg-background px-2 text-[10px] text-muted-foreground">
            <Search className="h-3 w-3" /> Search
          </div>
        </div>
        <div className="space-y-1.5 p-2.5">
          <p className="px-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Triggers</p>
          {['Page View', 'Exit Intent'].map((t) => (
            <div key={t} className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-2 py-1.5 text-[10px] font-medium text-foreground">
              <Globe className="h-3 w-3 text-primary" /> {t}
            </div>
          ))}
          <p className="mt-2 px-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">Actions</p>
          {['Show Popup', 'Send Email'].map((t) => (
            <div key={t} className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card px-2 py-1.5 text-[10px] font-medium text-foreground">
              <Plus className="h-3 w-3 text-indigo-500" /> {t}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ========================================================================== */
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
                <div className="h-2 w-2 rounded-lg-full bg-black/20" />
                <div className="h-1.5 w-20 rounded-lg-full bg-black/10" />
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-2.5 w-3/4 rounded-lg-full bg-black/15" />
                <div className="h-2.5 w-1/2 rounded-lg-full bg-black/10" />
                <div className="mt-3 h-6 w-24 rounded-lg bg-primary/80" />
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="h-9 rounded-lg bg-black/[0.06]" />
                  <div className="h-9 rounded-lg bg-black/[0.06]" />
                  <div className="h-9 rounded-lg bg-black/[0.06]" />
                </div>
              </div>
            </div>
            <div className="absolute left-[56%] top-[62%]">
              <span className="absolute -inset-2 animate-ping rounded-lg-full bg-primary/40" />
              <MousePointer2 className="relative h-4 w-4 fill-white text-white drop-shadow" />
            </div>
          </div>

          {/* Transport bar */}
          <div className="border-t border-zinc-800/80 bg-zinc-900/90 px-3 py-2">
            <div className="flex items-center gap-2">
              <Rewind className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg-full bg-primary text-primary-foreground shadow-sm">
                <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
              </div>
              <FastForward className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <div className="relative mx-1 h-2 min-w-0 flex-1">
                <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-lg-full bg-zinc-700/50" />
                <div className="absolute left-0 top-1/2 h-2 w-[46%] -translate-y-1/2 rounded-lg-full bg-white/85" />
                <div className="absolute left-[46%] top-1/2 h-3.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-lg-full border border-zinc-900 bg-white" />
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
const SLOTS = [
  { w: 80, ty: 0, z: 40, sc: 1.02 }, // front / active
  { w: 90, ty: 52, z: 20, sc: 1 },
  { w: 100, ty: 104, z: 10, sc: 1 },
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
            }}
            className={cn(
              'group relative h-[420px] w-full overflow-hidden rounded-lg-2xl border border-border/60 bg-card outline-none sm:h-[480px]',
              'shadow-[0_30px_60px_-12px_rgba(0,0,0,0.4),0_12px_24px_-8px_rgba(0,0,0,0.25)]',
              'transition-all duration-500 ease-out md:cursor-pointer',
              // Mobile: only the selected preview is shown (tabs switch it).
              i !== active && 'hidden md:block',
              // Desktop: slot-based cascade — width, offset, z and scale come from the slot,
              // so activating a layer animates every layer to its new slot.
              'md:absolute md:left-1/2 md:top-0 md:h-[600px] md:[width:var(--w)] md:[transform:translateX(-50%)_translateY(var(--ty))_scale(var(--sc))] md:[z-index:var(--z)]',
              isActive
                ? 'md:shadow-[0_45px_90px_-18px_rgba(0,0,0,0.55)] md:shadow-primary/10'
                : 'md:brightness-[0.55]',
              'md:focus-visible:ring-2 md:focus-visible:ring-primary/50',
            )}
          >
            {p.node}

            {/* Corner label — desktop only (mobile uses the tab bar) */}
            <span className="pointer-events-none absolute left-3 top-3 z-20 hidden rounded-lg-full border border-border/60 bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur md:block">
              {p.label}
            </span>

            {/* Hover cue — prompt to click (desktop, non-front layers) */}
            {!isActive && (
              <span className="pointer-events-none absolute left-1/2 bottom-3 z-30 hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg-full bg-foreground/90 px-3 py-1.5 text-[11px] font-semibold text-background opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 md:flex md:group-hover:opacity-100">
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
