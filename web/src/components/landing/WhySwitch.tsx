'use client';

import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

const PAINS = [
  {
    ga4: 'Data is sent to Google — they own and monetise your visitors\' behaviour',
    seentics: 'Self-hosted. Your data stays on your server, forever.',
  },
  {
    ga4: 'Sampled data above 500k sessions — you never see the full picture',
    seentics: 'Every event is tracked. No sampling, no approximations.',
  },
  {
    ga4: 'No session recordings or heatmaps — you see numbers, not behaviour',
    seentics: 'Watch exactly what users do with replays and heatmaps built in.',
  },
  {
    ga4: 'Complex, bloated UI that takes hours to find a simple metric',
    seentics: 'Clean dashboard. Pageviews, sources, funnels — all in one view.',
  },
  {
    ga4: 'Requires cookie consent banners in most countries (GDPR)',
    seentics: 'Cookie-free tracking. GDPR compliant out of the box.',
  },
  {
    ga4: 'No funnel builder, no automations, no AI insights',
    seentics: 'Funnels, automations, and AI analysis — no third-party tools needed.',
  },
];

export default function WhySwitch() {
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-block bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1.5 mb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">Why switch</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
            GA4 is holding your <span className="text-primary">growth back</span>
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Google Analytics 4 was built for Google's ad business — not for yours.
            Here's what you're giving up by staying on it.
          </p>
        </div>

        {/* Comparison table */}
        <div className="max-w-3xl mx-auto">
          {/* Column headers */}
          <div className="grid grid-cols-2 gap-4 mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <X className="h-3 w-3 text-red-500" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">Google Analytics 4</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-emerald-500" />
              </div>
              <span className="text-sm font-semibold text-foreground">Seentics</span>
            </div>
          </div>

          {/* Rows */}
          <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
            {PAINS.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className="grid grid-cols-2 gap-0"
              >
                {/* GA4 side */}
                <div className="flex items-start gap-3 p-4 bg-red-500/[0.03] border-r border-border/40">
                  <X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground leading-relaxed">{row.ga4}</span>
                </div>
                {/* Seentics side */}
                <div className="flex items-start gap-3 p-4 bg-emerald-500/[0.03]">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground leading-relaxed font-medium">{row.seentics}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
