'use client';

import { motion } from 'framer-motion';
import { BarChart3, Shield, Filter, Play, MousePointer2, Workflow } from 'lucide-react';
import React from 'react';

const features = [
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Live visitor count, pageviews, referrers, and custom events — updated in under a second.',
    color: 'text-indigo-500 bg-indigo-500/10',
  },
  {
    icon: MousePointer2,
    title: 'Click & Scroll Heatmaps',
    description: 'See exactly where users click and how far they scroll on every page of your site.',
    color: 'text-orange-500 bg-orange-500/10',
  },
  {
    icon: Play,
    title: 'Session Recordings',
    description: 'Replay real visitor sessions to find UX issues, debug problems, and understand behavior.',
    color: 'text-indigo-500 bg-indigo-500/10',
  },
  {
    icon: Filter,
    title: 'Conversion Funnels',
    description: 'Define multi-step funnels and see exactly where users drop off in your signup or checkout flow.',
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    icon: Workflow,
    title: 'Behavioral Automations',
    description: 'Trigger emails, webhooks, popups, or Slack alerts based on what users do on your site.',
    color: 'text-amber-500 bg-amber-500/10',
  },
  {
    icon: Shield,
    title: 'Privacy by Default',
    description: 'No cookies, no personal data collection. GDPR, CCPA, and PECR compliant out of the box.',
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
            Everything You Need in One Script
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Analytics, heatmaps, recordings, funnels, and automations — a single 2KB script replaces your entire analytics stack.
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
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {feature.title}
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
