'use client';

import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Cell = true | false | 'partial';

const TOOLS = ['Google Analytics 4', 'Plausible', 'Hotjar'] as const;

const ROWS: { feature: string; seentics: Cell; ga4: Cell; plausible: Cell; hotjar: Cell }[] = [
  { feature: 'Privacy-first, cookie-free', seentics: true, ga4: false, plausible: true, hotjar: false },
  { feature: 'Self-hosted — you own your data', seentics: true, ga4: false, plausible: 'partial', hotjar: false },
  { feature: 'No data sampling', seentics: true, ga4: false, plausible: true, hotjar: true },
  { feature: 'Session recordings & replays', seentics: true, ga4: false, plausible: false, hotjar: true },
  { feature: 'Heatmaps', seentics: true, ga4: false, plausible: false, hotjar: true },
  { feature: 'Conversion funnels', seentics: true, ga4: true, plausible: 'partial', hotjar: 'partial' },
  { feature: 'Automations & triggers', seentics: true, ga4: false, plausible: false, hotjar: false },
  { feature: 'No-code workflow builder', seentics: true, ga4: false, plausible: false, hotjar: false },
  { feature: 'AI insights in plain English', seentics: true, ga4: 'partial', plausible: false, hotjar: false },
  { feature: 'Open source', seentics: true, ga4: false, plausible: true, hotjar: false },
  { feature: 'All-in-one platform', seentics: true, ga4: false, plausible: false, hotjar: false },
];

function CellMark({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15">
        <Minus className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted">
      <X className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={3} />
    </span>
  );
}

function ToolCell({ label, value, highlight }: { label: string; value: Cell; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5',
        highlight ? 'border-primary/30 bg-primary/[0.06]' : 'border-border/50',
      )}
    >
      <span className={cn('text-xs font-medium', highlight ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
      <CellMark value={value} />
    </div>
  );
}

export default function WhySwitch() {
  return (
    <section className="bg-background py-24 md:py-32">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <div className="mb-6 inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Why switch</span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-foreground mb-4 leading-[1.05]">
            Seentics Gives <span className="text-primary">Everything</span>
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            GA4, Plausible, Hotjar — each solves one piece of the puzzle. Seentics unifies analytics,
            recordings, heatmaps, funnels, and automations. Self-hosted, open source, no cookies.
          </p>
        </div>

        {/* Comparison matrix — mobile (stacked cards) */}
        <div className="mx-auto max-w-md space-y-3 md:hidden">
          {ROWS.map((row) => (
            <div key={row.feature} className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">{row.feature}</p>
              <div className="grid grid-cols-2 gap-2">
                <ToolCell label="Seentics" value={row.seentics} highlight />
                <ToolCell label="GA4" value={row.ga4} />
                <ToolCell label="Plausible" value={row.plausible} />
                <ToolCell label="Hotjar" value={row.hotjar} />
              </div>
            </div>
          ))}
        </div>

        {/* Comparison matrix — desktop table */}
        <div className="mx-auto hidden max-w-6xl overflow-x-auto md:block">
          <table className="w-full min-w-[680px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-[34%] p-3 text-left align-bottom" />
                <th className="p-3 text-center align-bottom">
                  <div className="rounded-lg-t-xl bg-primary/[0.07] px-2 pb-2 pt-3">
                    <span className="text-sm font-bold text-primary">Seentics</span>
                  </div>
                </th>
                {TOOLS.map((tool) => (
                  <th key={tool} className="p-3 text-center align-bottom">
                    <span className="text-xs font-semibold text-muted-foreground sm:text-sm">{tool}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <motion.tr
                  key={row.feature}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  <td className="border-b border-border/50 py-3 pr-4 text-sm font-medium text-foreground">
                    {row.feature}
                  </td>
                  <td
                    className={`border-b border-border/50 px-2 py-3 text-center bg-primary/[0.07] ${
                      i === ROWS.length - 1 ? 'rounded-lg-b-xl' : ''
                    }`}
                  >
                    <div className="flex justify-center">
                      <CellMark value={row.seentics} />
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-2 py-3 text-center">
                    <div className="flex justify-center">
                      <CellMark value={row.ga4} />
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-2 py-3 text-center">
                    <div className="flex justify-center">
                      <CellMark value={row.plausible} />
                    </div>
                  </td>
                  <td className="border-b border-border/50 px-2 py-3 text-center">
                    <div className="flex justify-center">
                      <CellMark value={row.hotjar} />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} /> Built in
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-amber-500" strokeWidth={3} /> Limited / partial
          </span>
          <span className="inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={3} /> Not available
          </span>
        </div>
      </div>
    </section>
  );
}
