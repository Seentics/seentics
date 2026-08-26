'use client';

import {
  MousePointer,
  Globe,
  Target,
  Zap,
  MessageSquare,
  Bell,
  Webhook,
  Mail,
  CornerDownRight,
  Code2,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

/* Node positions live in a 1000 × 560 coordinate space shared by the SVG edges and the
   absolutely-positioned node cards, so the flowing arrows always land on the nodes. */

const TRIGGERS = [
  { icon: MousePointer, label: 'Exit Intent', desc: 'Cursor leaves viewport', color: 'text-rose-500', bg: 'bg-rose-500/10', y: 70 },
  { icon: Globe, label: 'Page View', desc: 'Matches URL / path rules', color: 'text-blue-500', bg: 'bg-blue-500/10', y: 210 },
  { icon: Target, label: 'Goal Reached', desc: 'Conversion or funnel hit', color: 'text-emerald-500', bg: 'bg-emerald-500/10', y: 350 },
  { icon: Zap, label: 'Custom Event', desc: 'Any event you fire', color: 'text-amber-500', bg: 'bg-amber-500/10', y: 490 },
];

const ACTIONS = [
  { icon: MessageSquare, label: 'Show Popup', desc: 'Modal with CTA or offer', color: 'text-violet-500', bg: 'bg-violet-500/10', y: 47 },
  { icon: Bell, label: 'Show Banner', desc: 'Top / bottom banner', color: 'text-indigo-500', bg: 'bg-indigo-500/10', y: 140 },
  { icon: Webhook, label: 'Call Webhook', desc: 'HTTP POST to any URL', color: 'text-sky-500', bg: 'bg-sky-500/10', y: 233 },
  { icon: Mail, label: 'Send Email', desc: 'Alert your team instantly', color: 'text-pink-500', bg: 'bg-pink-500/10', y: 327 },
  { icon: CornerDownRight, label: 'Redirect', desc: 'Send to another page', color: 'text-orange-500', bg: 'bg-orange-500/10', y: 420 },
  { icon: Code2, label: 'Run Script', desc: 'Execute custom JS', color: 'text-teal-500', bg: 'bg-teal-500/10', y: 513 },
];

const HUB = { x: 500, y: 280 };
const TRIG_X = 160;
const ACT_X = 840;

function pctLeft(x: number) {
  return `${(x / 1000) * 100}%`;
}
function pctTop(y: number) {
  return `${(y / 560) * 100}%`;
}

type FlowNode = { icon: typeof Zap; label: string; desc: string; color: string; bg: string };

function FlowChip({ item }: { item: FlowNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2.5 shadow-sm">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
        <item.icon className={`h-4 w-4 ${item.color}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">{item.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{item.desc}</p>
      </div>
    </div>
  );
}

export default function HowAutomationsWork() {
  return (
    <section className="relative overflow-hidden bg-transparent py-24 md:py-32">
      <style>{`
        @keyframes seenticsFlow { to { stroke-dashoffset: -28; } }
        @keyframes seenticsPulse { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: .7; transform: scale(1.08); } }
      `}</style>

      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-500">
            <Zap className="h-3 w-3" />
            Automations
          </div>
            
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-foreground mb-4 leading-[1.05]">
           Automate Anything, <span className="text-primary">Instantly</span>
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Connect any visitor behavior to any action — no code required. Build rules visually, deploy in seconds. 
          </p>
        </div>

        {/* Mobile vertical flow */}
        <div className="md:hidden">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            When this happens
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {TRIGGERS.map((t) => (
              <FlowChip key={t.label} item={t} />
            ))}
          </div>

          <div className="my-4 flex flex-col items-center">
            <div className="h-5 w-px bg-border" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <span className="absolute inset-0 rounded-full bg-primary/30" style={{ animation: 'seenticsPulse 2s ease-in-out infinite' }} />
              <Zap className="relative h-6 w-6 fill-current" />
            </div>
            <p className="mt-1.5 text-xs font-bold text-foreground">Seentics</p>
            <div className="h-5 w-px bg-border" />
          </div>

          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Do this automatically
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {ACTIONS.map((a) => (
              <FlowChip key={a.label} item={a} />
            ))}
          </div>
        </div>

        {/* Live flow diagram (desktop, transparent — no card) */}
        <div className="hidden overflow-x-auto pb-4 md:block">
          <div className="relative mx-auto aspect-[1000/560] w-full min-w-[860px] max-w-6xl">
            {/* Soft glow behind the hub */}
            <div
              className="pointer-events-none absolute h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
              style={{ left: pctLeft(HUB.x), top: pctTop(HUB.y) }}
            />

            {/* Edges */}
            <svg viewBox="0 0 1000 560" className="absolute inset-0 h-full w-full" fill="none">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" className="fill-primary/70" />
                </marker>
              </defs>

              {/* Trigger → hub */}
              {TRIGGERS.map((t, i) => {
                const d = `M ${TRIG_X},${t.y} C 340,${t.y} 360,${HUB.y} 430,${HUB.y}`;
                return (
                  <g key={`t-${i}`}>
                    <path d={d} className="stroke-border" strokeWidth={2} />
                    <path
                      d={d}
                      className="stroke-primary"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray="2 12"
                      markerEnd="url(#arrow)"
                      style={{ animation: `seenticsFlow 1.1s linear infinite`, animationDelay: `${i * 0.18}s` }}
                    />
                  </g>
                );
              })}

              {/* Hub → action */}
              {ACTIONS.map((a, i) => {
                const d = `M ${HUB.x + 60},${HUB.y} C 660,${HUB.y} 660,${a.y} 748,${a.y}`;
                return (
                  <g key={`a-${i}`}>
                    <path d={d} className="stroke-border" strokeWidth={2} />
                    <path
                      d={d}
                      className="stroke-primary"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray="2 12"
                      markerEnd="url(#arrow)"
                      style={{ animation: `seenticsFlow 1.1s linear infinite`, animationDelay: `${0.4 + i * 0.14}s` }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Column captions */}
            <span className="absolute -translate-x-1/2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground" style={{ left: pctLeft(TRIG_X), top: '-6%' }}>
              When this happens
            </span>
            <span className="absolute -translate-x-1/2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground" style={{ left: pctLeft(ACT_X), top: '-6%' }}>
              Do this automatically
            </span>

            {/* Trigger nodes */}
            {TRIGGERS.map((t) => (
              <div
                key={t.label}
                className="absolute flex w-[190px] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-lg border border-border/60 bg-card/90 px-3 py-2.5 shadow-lg shadow-black/[0.06] backdrop-blur"
                style={{ left: pctLeft(TRIG_X), top: pctTop(t.y) }}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.bg}`}>
                  <t.icon className={`h-4 w-4 ${t.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{t.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            ))}

            {/* Hub */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pctLeft(HUB.x), top: pctTop(HUB.y) }}
            >
              <div className="relative flex h-24 w-24 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-primary/30" style={{ animation: 'seenticsPulse 2s ease-in-out infinite' }} />
                <span className="absolute inset-2 rounded-full bg-primary/20" style={{ animation: 'seenticsPulse 2s ease-in-out infinite', animationDelay: '.4s' }} />
                <div className="relative flex h-16 w-16 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30">
                  <Zap className="h-6 w-6 fill-current" />
                </div>
              </div>
              <p className="mt-2 text-center text-xs font-bold text-foreground">Seentics</p>
            </div>

            {/* Action nodes */}
            {ACTIONS.map((a) => (
              <div
                key={a.label}
                className="absolute flex w-[190px] -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-lg border border-border/60 bg-card/90 px-3 py-2.5 shadow-lg shadow-black/[0.06] backdrop-blur"
                style={{ left: pctLeft(ACT_X), top: pctTop(a.y) }}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.bg}`}>
                  <a.icon className={`h-4 w-4 ${a.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{a.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Build your first automation in under 2 minutes — no code required.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start automating free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
