'use client';

import { motion } from 'framer-motion';
import { BarChart3, Video, Flame, Bot, Lock, Sparkles } from 'lucide-react';
import React from 'react';

const features = [
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Pageviews, sessions, bounce rate, top pages, referrers, devices, and geography — live and historical.',
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    icon: Sparkles,
    title: 'Seentics AI',
    description: 'Ask anything about your data in plain English. AI generates SQL, runs it, and renders beautiful charts — across analytics, revenue, replays, heatmaps, funnels, and automations.',
    color: 'text-indigo-500 bg-indigo-500/10',
    badge: 'BETA',
  },
  {
    icon: Video,
    title: 'Session Recordings',
    description: 'Replay how real users navigate your product. Catch friction and bugs before they cost you.',
    color: 'text-violet-500 bg-violet-500/10',
  },
  {
    icon: Flame,
    title: 'Heatmaps',
    description: 'See where users click, scroll, and hover on any page — no code needed.',
    color: 'text-orange-500 bg-orange-500/10',
  },
  {
    icon: Bot,
    title: 'Automations',
    description: 'Fire webhooks, emails, or any action when users hit specific behaviors or conditions.',
    color: 'text-indigo-500 bg-indigo-500/10',
  },
  {
    icon: Lock,
    title: 'Privacy First',
    description: 'No cookies, GDPR-compliant by default. Self-host for complete data ownership.',
    color: 'text-teal-500 bg-teal-500/10',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
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
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Everything in one platform
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Analytics, recordings, heatmaps, funnels, and automations — built to be extended with APIs and embeddable components.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="group p-6 rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-lg hover:shadow-black/[0.03] transition-all"
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${feature.color}`}>
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                {feature.title}
                {'badge' in feature && feature.badge && (
                  <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400 tracking-wide">
                    {feature.badge}
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
