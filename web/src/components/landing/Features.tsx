'use client';

import { motion } from 'framer-motion';
import { BarChart3, Code, Zap, Database, Lock, Layers } from 'lucide-react';
import React from 'react';

const features = [
  {
    icon: Code,
    title: 'REST APIs',
    description: 'Query analytics data programmatically. Events, pageviews, funnels, heatmaps — all accessible via clean, well-documented APIs.',
    color: 'text-indigo-500 bg-indigo-500/10',
  },
  {
    icon: Layers,
    title: 'React Components',
    description: 'Pre-built UI components for charts, dashboards, and analytics visualizations. Drop them into your app in minutes.',
    color: 'text-sky-500 bg-sky-500/10',
  },
  {
    icon: Database,
    title: 'Raw Data Access',
    description: 'Access raw events and analytics data. Build custom reports, integrate with BI tools, or export for analysis.',
    color: 'text-orange-500 bg-orange-500/10',
  },
  {
    icon: Zap,
    title: 'Event Tracking',
    description: 'Track custom events programmatically. Send events from your backend, frontend, or any system — no limitations.',
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    icon: BarChart3,
    title: 'Custom Dashboards',
    description: 'Build custom analytics dashboards tailored to your product. Full control over metrics, layout, and design.',
    color: 'text-amber-500 bg-amber-500/10',
  },
  {
    icon: Lock,
    title: 'Self-Hosted',
    description: 'Deploy on your own infrastructure. Own your data, control your privacy policy, customize everything.',
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
            Built for Developers
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            APIs, SDKs, and composable components for complete customization.
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
