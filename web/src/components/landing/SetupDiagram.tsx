'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { ActivitySquare, BarChart3, Check, Globe, Radio, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ObserveGlyph } from './LandingHeader';

/**
 * How it works, drawn as the thing it describes: three pipelines, one per product, each
 * running source → Seentics → result. The three steps are a real sequence (connect, send,
 * see), so the diagram walks through them: the part of every pipeline that step is about
 * lights up, and data moves along the pipes while it is "sent".
 *
 * Every pipeline is accurate to how the product works. Analytics is fed by a script on your
 * site; Observability by OpenTelemetry from your services; Uptime goes the other way, with
 * Seentics reaching out to your URL every minute, so its packets travel back to the source.
 */
const STEP_MS = 3400;

const STEPS = [
  { title: 'Connect', body: 'Add a site, a service or an endpoint. It takes a minute.' },
  { title: 'Send', body: 'Paste one script tag, point OpenTelemetry at Seentics, or let our checks reach your URL.' },
  { title: 'See', body: 'Dashboards, traces and alerts fill in as data arrives.' },
] as const;

type Packet = { label: string; tone?: string; reverse?: boolean; delay: number };

const ROWS = [
  {
    id: 'analytics',
    color: 'hsl(var(--primary))',
    source: { icon: Globe, title: 'Your website', detail: '<script data-website-id>' },
    product: { icon: BarChart3, name: 'Analytics', metric: '432 visitors online' },
    packets: [
      { label: 'pageview', delay: 0 },
      { label: 'click', delay: 0.6 },
      { label: 'scroll 80%', delay: 1.2 },
    ] as Packet[],
  },
  {
    id: 'observability',
    color: 'hsl(267 60% 52%)',
    source: { icon: Server, title: 'Your services', detail: 'OpenTelemetry' },
    product: { icon: ObserveGlyph, name: 'Observability', metric: '48.2k logs / min' },
    packets: [
      { label: 'INFO', tone: '#38bdf8', delay: 0 },
      { label: 'WARN', tone: '#f59e0b', delay: 0.6 },
      { label: 'ERROR', tone: '#f43f5e', delay: 1.2 },
    ] as Packet[],
  },
  {
    id: 'uptime',
    color: 'hsl(145 72% 38%)',
    source: { icon: Radio, title: 'Your site and APIs', detail: 'checked every 60 s' },
    product: { icon: ActivitySquare, name: 'Uptime', metric: '99.98% this month' },
    // Seentics reaches out: the request travels to your site, the answer comes back.
    packets: [
      { label: 'GET /', reverse: true, delay: 0 },
      { label: '200 · 142 ms', delay: 0.85 },
    ] as Packet[],
  },
] as const;

const CSS = `
@keyframes dd-flow { from { left: -6%; opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } to { left: 100%; opacity: 0 } }
@keyframes dd-fill { from { width: 0 } to { width: 100% } }
@keyframes dd-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .dd-dot, .dd-bar, .dd-rise { animation: none !important } }
`;

function Pipe({ color, live, packets }: { color: string; live: boolean; packets: Packet[] }) {
  return (
    <div className="relative mx-1 hidden h-10 min-w-[90px] flex-1 items-center md:flex" aria-hidden>
      <div className="h-px w-full transition-colors duration-500" style={{ background: live ? color : 'hsl(var(--border))' }} />
      {live &&
        packets.map((p) => (
          <span
            key={p.label}
            className="dd-dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground shadow-sm"
            style={{
              borderColor: p.tone ?? color,
              color: p.tone,
              animation: `dd-flow 2.2s linear ${p.delay}s infinite ${p.reverse ? 'reverse' : 'normal'}`,
            }}
          >
            {p.label}
          </span>
        ))}
    </div>
  );
}

function Node({ lit, children, className }: { lit: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[88px] flex-col justify-center rounded-xl border bg-card p-3.5 transition-all duration-500',
        lit ? 'border-foreground/25 opacity-100 shadow-lg shadow-black/10' : 'border-border opacity-55',
        className,
      )}
    >
      {children}
    </div>
  );
}

const bar = (on: boolean, width: string, color: string, left = '0%') => (
  <span className="relative block h-2 rounded-full bg-muted">
    <span
      className="absolute top-0 h-2 rounded-full transition-all duration-700"
      style={{ left, width: on ? width : '0%', background: color }}
    />
  </span>
);

/** What each product hands back, as a miniature of its own screen rather than a label. */
function Result({ id, color, see }: { id: string; color: string; see: boolean }) {
  if (id === 'analytics') {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-foreground">Checkout funnel</p>
        {bar(see, '100%', color)}
        {bar(see, '64%', color)}
        {bar(see, '31%', color)}
      </div>
    );
  }
  if (id === 'observability') {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-foreground">Trace · POST /checkout</p>
        {bar(see, '100%', color)}
        {bar(see, '46%', color, '8%')}
        {bar(see, '38%', '#f43f5e', '56%')}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
        <span className={cn('h-2 w-2 rounded-full transition-colors duration-500', see ? 'bg-rose-500' : 'bg-muted-foreground/40')} />
        checkout.acme.com is down
      </p>
      <p className="text-[11px] text-muted-foreground">Alert sent to Slack, email and SMS</p>
    </div>
  );
}

export default function SetupDiagram() {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: '-25% 0px -25% 0px' });
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused || !inView) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, [reduce, paused, inView]);

  const connect = step === 0;
  const send = step === 1;
  const see = step === 2;

  return (
    <section id="how-it-works" className="landing-section">
      <style>{CSS}</style>
      <div className="landing-container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="mb-3 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Connect. Send. See.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every product runs on its own pipeline. Set up one, or all three.
          </p>
        </div>

        <div
          ref={root}
          className="mx-auto max-w-5xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* The three steps */}
          <div role="tablist" aria-label="How it works" className="mb-3 grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => {
              const on = i === step;
              return (
                <button
                  key={s.title}
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    setStep(i);
                    setPaused(true);
                  }}
                  className="group text-left"
                >
                  <span className="mb-2 block h-[3px] overflow-hidden rounded-full bg-border">
                    {on && (
                      <span
                        key={`${step}-${paused}`}
                        className="dd-bar block h-full bg-foreground"
                        style={{ animation: paused || reduce ? undefined : `dd-fill ${STEP_MS}ms linear forwards`, width: paused || reduce ? '100%' : undefined }}
                      />
                    )}
                  </span>
                  <span className={cn('flex items-center gap-2 text-sm font-semibold transition-colors', on ? 'text-foreground' : 'text-muted-foreground')}>
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                        on ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </span>
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
          <p key={step} className="dd-rise mb-8 min-h-[2.75rem] text-sm text-muted-foreground sm:text-base" style={{ animation: 'dd-rise 0.4s ease both' }}>
            {STEPS[step].body}
          </p>

          {/* The pipelines */}
          <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
            <div className="mb-3 hidden items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:flex">
              <span className="w-[200px]">Your stack</span>
              <span className="flex-1" />
              <span className="w-[200px]">Seentics</span>
              <span className="flex-1" />
              <span className="w-[200px]">What you get</span>
            </div>

            <div className="space-y-4">
              {ROWS.map((row) => (
                <div key={row.id} className="flex flex-col gap-2 md:flex-row md:items-center md:gap-0">
                  <Node lit={connect || send} className="md:w-[200px]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                        <row.source.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{row.source.title}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{row.source.detail}</p>
                      </div>
                    </div>
                    {connect && (
                      <p className="dd-rise mt-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400" style={{ animation: 'dd-rise 0.4s ease both' }}>
                        <Check className="h-3 w-3" /> Connected
                      </p>
                    )}
                  </Node>

                  <Pipe color={row.color} live={send} packets={row.packets} />

                  <Node lit={send || see} className="md:w-[200px]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: row.color }}>
                        <row.product.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{row.product.name}</p>
                        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', see ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                          {row.product.metric}
                        </p>
                      </div>
                    </div>
                  </Node>

                  <Pipe color={row.color} live={see} packets={[{ label: row.id === 'uptime' ? 'alert' : 'insight', delay: 0 }]} />

                  <Node lit={see} className="md:w-[200px]">
                    <Result id={row.id} color={row.color} see={see} />
                  </Node>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
