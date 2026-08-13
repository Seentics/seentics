'use client';

import { motion } from 'framer-motion';
import { BarChart3, Compass, Bot, Check } from 'lucide-react';
import React from 'react';

const pillars = [
  {
    icon: BarChart3,
    title: 'Analytics',
    tagline: 'Understand what happens across your site — live and historical, no cookies required.',
    color: 'text-blue-500 bg-blue-500/10',
    items: [
      'Pageviews, sessions & bounce rate',
      'Top pages, referrers & UTM sources',
      'Devices, browsers & geography',
      'Privacy-first, GDPR-compliant by default',
    ],
  },
  {
    icon: Compass,
    title: 'Explore',
    tagline: 'Go beyond the numbers to see the why behind every user behavior.',
    color: 'text-violet-500 bg-violet-500/10',
    badge: 'AI',
    items: [
      'Session recordings & replays',
      'Click, scroll & hover heatmaps',
      'Conversion funnels',
      'Seentics AI — ask your data in plain English',
    ],
  },
  {
    icon: Bot,
    title: 'Automations',
    tagline: 'Turn insight into action the moment a user behavior happens.',
    color: 'text-indigo-500 bg-indigo-500/10',
    items: [
      'Trigger on behaviors & conditions',
      'Webhooks, emails & in-page actions',
      'Visual, no-code workflow builder',
      'Real-time, event-driven execution',
    ],
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
          >
            Features
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-foreground mb-4 leading-[1.05]"
          >
            Analyze. Explore. <span className="text-primary">Automate.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Three pillars, one open-source platform — from understanding your users to acting on what you discover.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="group flex flex-col p-8 rounded-2xl border border-border/50 bg-card hover:border-border hover:shadow-xl hover:shadow-black/[0.04] transition-all"
            >
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-5 shrink-0 ${pillar.color}`}>
                <pillar.icon className="h-6 w-6" />
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                {pillar.title}
                {'badge' in pillar && pillar.badge && (
                  <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400 tracking-wide">
                    {pillar.badge}
                  </span>
                )}
              </h3>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {pillar.tagline}
              </p>

              <ul className="mt-auto space-y-3 border-t border-border/50 pt-6">
                {pillar.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-foreground/90">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
