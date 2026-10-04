'use client';

import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "What would you pay for otherwise?" — categories, not a vendor-by-vendor feature
 * matrix. The tools named are common examples of each category, so nothing here claims a
 * specific competitor lacks a feature. Picking rows works out how many separate tools
 * Seentics replaces and which plan family fits.
 */
const ROWS = [
  { id: 'analytics', need: 'Web analytics and funnels', usually: 'Google Analytics, Plausible', product: 'Analytics', color: 'hsl(var(--primary))' },
  { id: 'replay', need: 'Session replay and heatmaps', usually: 'Hotjar, FullStory', product: 'Analytics', color: 'hsl(var(--primary))' },
  { id: 'automations', need: 'Behavior-triggered automations', usually: 'A separate popup or automation tool', product: 'Analytics', color: 'hsl(var(--primary))' },
  { id: 'observability', need: 'Logs, metrics and traces', usually: 'Datadog, Grafana Cloud', product: 'Observability', color: 'hsl(267 60% 52%)' },
  { id: 'uptime', need: 'Uptime monitoring and status page', usually: 'UptimeRobot, Better Stack', product: 'Uptime', color: 'hsl(145 72% 38%)' },
] as const;

type RowId = (typeof ROWS)[number]['id'];

export default function CompareTable() {
  const [picked, setPicked] = useState<Set<RowId>>(new Set(['analytics', 'replay']));

  const toggle = (id: RowId) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = picked.size;
  const needsSuite = picked.has('observability') || picked.has('uptime');

  return (
    <section id="compare" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="landing-eyebrow">Why Seentics</p>
          <h2 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-4">Replace a stack of tools with one.</h2>
          <p className="landing-lead">Tick what you need today and see what it would otherwise take.</p>
        </div>

        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[1.2fr_1.2fr_0.9fr] gap-4 border-b border-border bg-muted/40 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            <span>You need</span>
            <span>You would usually buy</span>
            <span>With Seentics</span>
          </div>

          <ul className="divide-y divide-border">
            {ROWS.map((row) => {
              const on = picked.has(row.id);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(row.id)}
                    className={cn(
                      'grid w-full grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 px-6 py-4 text-left transition-colors sm:grid-cols-[1.2fr_1.2fr_0.9fr]',
                      on ? 'bg-primary/[0.04]' : 'hover:bg-muted/40',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-[15px] font-semibold text-foreground">{row.need}</span>
                    </span>
                    <span className={cn('text-sm sm:order-none', on ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-muted-foreground')}>
                      {row.usually}
                    </span>
                    <span className="col-span-2 flex items-center gap-2 text-sm font-semibold sm:col-span-1" style={{ color: row.color }}>
                      <Check className="h-4 w-4" />
                      {row.product}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col items-start justify-between gap-4 border-t border-border bg-muted/40 px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-[15px] text-foreground">
              {count === 0 ? (
                'Pick what you need above.'
              ) : (
                <>
                  <span className="font-bold">
                    {count} {count === 1 ? 'tool' : 'tools'} → 1 platform.
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {needsSuite ? 'The Suite plan covers this.' : 'The Analytics plan covers this.'}
                  </span>
                </>
              )}
            </p>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              See pricing
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">Tools named are common examples of each category.</p>
      </div>
    </section>
  );
}
