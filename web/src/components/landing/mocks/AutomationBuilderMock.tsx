import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Clock,
  Coffee,
  Filter,
  GripVertical,
  Globe,
  Layout,
  LogOut,
  Maximize,
  MessageSquare,
  Minus,
  MousePointer,
  Plus,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The automation builder, mid-edit.
 *
 * A faithful copy of `components/automations/canvas/AutomationNodes.tsx` and the
 * builder's own layout — 260px cards, the 1.5px kind strip down the left edge, the
 * uppercase eyebrow, real connection handles top and bottom, named branch outlets,
 * ReactFlow's dotted background and its bottom-left zoom stack, and the right-hand
 * node palette at its base width. The colours come from `nodeVisual` /
 * `TRIGGER_TYPES` / `ACTION_TYPES`, so a card here is the card the builder draws.
 *
 * The graph cannot be the real ReactFlow canvas: that mounts a resize observer, an
 * interaction layer and a drag system for a picture nobody can touch. Positions and
 * edge paths are therefore laid out by hand in the canvas's own coordinate space —
 * the constants below — which is also what lets the shot be composed rather than
 * fit-viewed into whatever ReactFlow decides.
 */

/* ── Canvas geometry ──────────────────────────────────────────────────────────
   The canvas is `CANVAS_W × CANVAS_H` with the palette beside it, and every node
   is placed in that space so the SVG edges can land exactly on the handles. */
const CANVAS_W = 780;
const NODE_W = 260;
/** Node heights, measured: p-4 twice plus the 40px icon tile, and a taller
    trigger because it carries a label line the action cards do not. */
const H_TRIGGER = 77;
const H_NODE = 72;

const TRIGGER = { x: 260, y: 54 };
const BRANCH = { x: 260, y: 214 };
const ACTION_YES = { x: 55, y: 414 };
const ACTION_NO = { x: 465, y: 414 };

const centreX = (x: number) => x + NODE_W / 2;
/** Where a branch node's outlets sit — ReactFlow spreads them at (i+1)/(n+1). */
const outletX = (x: number, i: number, n: number) => x + ((i + 1) / (n + 1)) * NODE_W;

const YES_X = outletX(BRANCH.x, 0, 2);
const NO_X = outletX(BRANCH.x, 1, 2);

/** ReactFlow's default bezier between a bottom and a top handle. */
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
}

const HANDLE = 'absolute h-3 w-3 rounded-full border-2 border-background';

/* ── Nodes ───────────────────────────────────────────────────────────────────── */

function NodeShell({
  x,
  y,
  strip,
  children,
}: {
  x: number;
  y: number;
  strip: string;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute w-[260px] overflow-visible rounded-lg border border-border bg-card p-4 pl-5 shadow-sm"
      style={{ left: x, top: y }}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1.5 rounded-l-lg', strip)} />
      {children}
    </div>
  );
}

/** A trigger. Source-only: nothing flows into the thing that starts the automation. */
function TriggerCard() {
  return (
    <NodeShell x={TRIGGER.x} y={TRIGGER.y} strip="bg-emerald-500">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
          <LogOut className="h-5 w-5 text-rose-500" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Trigger
          </span>
          <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-foreground">
            Exit Intent
          </p>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
            Triggers when a user is about to leave
          </p>
        </div>
      </div>
      <span className={cn(HANDLE, '-bottom-1.5 left-1/2 -translate-x-1/2 bg-emerald-500')} />
    </NodeShell>
  );
}

/** An action or branch card: eyebrow + one-line summary, per `nodeSummary`. */
function GraphCard({
  x,
  y,
  strip,
  iconBg,
  iconColor,
  icon: Icon,
  title,
  summary,
  outlets,
}: {
  x: number;
  y: number;
  strip: string;
  iconBg: string;
  iconColor: string;
  icon: typeof Filter;
  title: string;
  summary: string;
  /** Named branch outlets. Omit for a single unnamed source handle. */
  outlets?: string[];
}) {
  return (
    <NodeShell x={x} y={y} strip={strip}>
      <span className={cn(HANDLE, '-top-1.5 left-1/2 -translate-x-1/2 bg-muted-foreground')} />

      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{summary}</p>
        </div>
      </div>

      {outlets ? (
        outlets.map((label, i) => {
          const left = `${((i + 1) / (outlets.length + 1)) * 100}%`;
          return (
            <span key={label}>
              <span
                className={cn(HANDLE, '-bottom-1.5 -translate-x-1/2 bg-primary')}
                style={{ left }}
              />
              {/* Naming the outlet is what makes dragging from the right one possible. */}
              <span
                className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-background px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
                style={{ left }}
              >
                {label}
              </span>
            </span>
          );
        })
      ) : (
        <span className={cn(HANDLE, '-bottom-1.5 left-1/2 -translate-x-1/2 bg-primary opacity-60')} />
      )}
    </NodeShell>
  );
}

/* ── Edges ───────────────────────────────────────────────────────────────────── */

/** An edge label — background chip and 10px semibold type, as ReactFlow renders it. */
function EdgeLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background px-1.5 py-[3px] text-[10px] font-semibold text-muted-foreground"
      style={{ left: x, top: y }}
    >
      {text}
    </span>
  );
}

function Edges() {
  return (
    <svg className="absolute inset-0 h-full w-full overflow-visible" fill="none">
      <defs>
        <marker
          id="mock-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#b1b1b7" />
        </marker>
      </defs>

      {/* Trigger → entry. Synthesised in the real canvas, and drawn in the
          muted-foreground it sets explicitly rather than ReactFlow's default. */}
      <path
        d={edgePath(centreX(TRIGGER.x), TRIGGER.y + H_TRIGGER, centreX(BRANCH.x), BRANCH.y)}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={2}
        strokeDasharray="5"
        markerEnd="url(#mock-arrow)"
        style={{ animation: 'seenticsMockDash 0.5s linear infinite' }}
      />

      {/* Branch outlets → actions */}
      <path
        d={edgePath(YES_X, BRANCH.y + H_NODE, centreX(ACTION_YES.x), ACTION_YES.y)}
        stroke="#b1b1b7"
        strokeWidth={2}
        strokeDasharray="5"
        markerEnd="url(#mock-arrow)"
        style={{ animation: 'seenticsMockDash 0.5s linear infinite' }}
      />
      <path
        d={edgePath(NO_X, BRANCH.y + H_NODE, centreX(ACTION_NO.x), ACTION_NO.y)}
        stroke="#b1b1b7"
        strokeWidth={2}
        strokeDasharray="5"
        markerEnd="url(#mock-arrow)"
        style={{ animation: 'seenticsMockDash 0.5s linear infinite' }}
      />
    </svg>
  );
}

/* ── Palette ─────────────────────────────────────────────────────────────────── */

/** Mirrors `PaletteRow` in the builder — icon tile, label, hint, grip. */
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
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm">
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

/** The first rows of `TRIGGER_TYPES`, colours included. The list overflows here as
    it does in the app — a scroll area clipped mid-row reads as a scroll area. */
const PALETTE_TRIGGERS = [
  { icon: Globe, iconBg: 'bg-sky-500/10', iconColor: 'text-sky-500', label: 'Page View', hint: 'Triggers when a user visits a specific page' },
  { icon: MousePointer, iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-500', label: 'Click', hint: 'Triggers when a user clicks an element' },
  { icon: TrendingDown, iconBg: 'bg-teal-500/10', iconColor: 'text-teal-500', label: 'Scroll Depth', hint: 'Triggers when a user scrolls to a depth' },
  { icon: Clock, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500', label: 'Time on Page', hint: 'Triggers after a user spends time on page' },
  { icon: LogOut, iconBg: 'bg-rose-500/10', iconColor: 'text-rose-500', label: 'Exit Intent', hint: 'Triggers when a user is about to leave' },
  { icon: Coffee, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-500', label: 'Inactivity', hint: 'Triggers after a user is inactive' },
  { icon: Zap, iconBg: 'bg-red-500/10', iconColor: 'text-red-500', label: 'Rage Click', hint: 'Triggers on repeated rapid clicks' },
  { icon: AlertTriangle, iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-600', label: 'Form Abandonment', hint: 'Triggers when a form is abandoned' },
  { icon: Zap, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500', label: 'Custom Event', hint: 'Triggers on a named custom event' },
];

function NodePalette() {
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="shrink-0 border-b border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">Add a node</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag onto the canvas to place it, then drag between handles to connect.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {(['triggers', 'conditions', 'actions'] as const).map((t) => (
            <span
              key={t}
              className={cn(
                'rounded-lg py-1.5 text-center text-xs font-semibold capitalize',
                t === 'triggers' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
        {PALETTE_TRIGGERS.map((t) => (
          <PaletteRow key={t.label} {...t} />
        ))}
      </div>
    </aside>
  );
}

/* ── Canvas controls ─────────────────────────────────────────────────────────── */

/** ReactFlow's `<Controls showInteractive={false} />`, bottom-left. Library
    defaults, not app tokens — that is what the builder actually shows. */
function CanvasControls() {
  return (
    <div className="absolute bottom-4 left-4 flex w-[27px] flex-col overflow-hidden rounded-[2px] shadow-lg">
      {[Plus, Minus, Maximize].map((Icon, i) => (
        <span
          key={i}
          className="flex h-[26px] items-center justify-center border-b border-[#eee] bg-[#fefefe] text-[#333] last:border-b-0"
        >
          <Icon className="h-3 w-3" strokeWidth={2.5} />
        </span>
      ))}
    </div>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────────────── */

export function AutomationBuilderMock() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <style>{`@keyframes seenticsMockDash { to { stroke-dashoffset: -10; } }`}</style>

      {/* Canvas — ReactFlow's `bg-muted/20` and its dotted background at gap 24 */}
      <div
        className="relative h-full bg-muted/20"
        style={{
          width: CANVAS_W,
          backgroundImage: 'radial-gradient(circle at 1px 1px, #91919a 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        <Edges />

        <TriggerCard />

        <GraphCard
          x={BRANCH.x}
          y={BRANCH.y}
          strip="bg-amber-500"
          iconBg="bg-amber-500/15"
          iconColor="text-amber-500"
          icon={Filter}
          title="If / else"
          summary="2 rules · and"
          outlets={['Yes', 'No']}
        />

        <GraphCard
          x={ACTION_YES.x}
          y={ACTION_YES.y}
          strip="bg-blue-500"
          iconBg="bg-blue-500/15"
          iconColor="text-blue-500"
          icon={MessageSquare}
          title="Show Modal"
          summary="Wait — 10% off your first order"
        />

        <GraphCard
          x={ACTION_NO.x}
          y={ACTION_NO.y}
          strip="bg-violet-500"
          iconBg="bg-violet-500/15"
          iconColor="text-violet-500"
          icon={Layout}
          title="Show Banner"
          summary="Free shipping on orders over $50"
        />

        {/* Edge labels last, so the branch names sit above the paths. */}
        <EdgeLabel x={(YES_X + centreX(ACTION_YES.x)) / 2} y={(BRANCH.y + H_NODE + ACTION_YES.y) / 2} text="Yes" />
        <EdgeLabel x={(NO_X + centreX(ACTION_NO.x)) / 2} y={(BRANCH.y + H_NODE + ACTION_NO.y) / 2} text="No" />

        <CanvasControls />
      </div>

      <NodePalette />
    </div>
  );
}
