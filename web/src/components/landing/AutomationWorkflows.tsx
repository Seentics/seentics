'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MousePointer2, Globe, AlertCircle, Zap } from 'lucide-react';

const workflows = [
  {
    title: 'Cart Abandonment Recovery',
    description: 'Instantly re-engage users who leave their cart to finish their purchase.',
    steps: [
      { label: 'Funnel Drop-off (Checkout)', type: 'trigger' },
      { label: 'Cart value > $100', type: 'condition' },
      { label: 'Send WhatsApp Message', type: 'action' },
    ],
    icon: MousePointer2,
  },
  {
    title: 'Exit-Intent Conversion',
    description: 'Stop losing visitors at the last second with a perfectly timed offer.',
    steps: [
      { label: 'Exit Intent detected', type: 'trigger' },
      { label: 'On Pricing Page', type: 'condition' },
      { label: 'Show Discount Modal', type: 'action' },
    ],
    icon: Globe,
  },
  {
    title: 'High-Value Prospect Alert',
    description: 'Instantly notify your sales team when a warm lead shows strong intent.',
    steps: [
      { label: 'Pricing Page visited', type: 'trigger' },
      { label: 'Spent > 3m on site', type: 'condition' },
      { label: 'Notify #sales on Slack', type: 'action' },
    ],
    icon: AlertCircle,
  },
];

const stepColors: Record<string, string> = {
  trigger: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  condition: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  action: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const stepLabels: Record<string, string> = {
  trigger: 'Trigger',
  condition: 'If',
  action: 'Then',
};

export default function AutomationWorkflows() {
  return (
    <section id="automations" className="py-24 md:py-32 bg-background border-t border-border/50">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 px-4">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Turn every click into an action
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-muted-foreground text-lg"
          >
            Build logical sequences that engage visitors when it matters most.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {workflows.map((workflow, index) => (
            <motion.div
              key={workflow.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="group p-8 rounded-2xl border border-border/50 bg-card hover:border-border transition-all hover:shadow-xl hover:shadow-primary/5 shadow-sm flex flex-col"
            >
              <div className="mb-8">
                <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center text-foreground mb-5 group-hover:scale-110 transition-transform">
                  <workflow.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-3 tracking-tight">{workflow.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {workflow.description}
                </p>
              </div>

              <div className="space-y-3 mt-auto">
                {workflow.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold w-14 text-center py-1 rounded-md uppercase tracking-wider ${stepColors[step.type]}`}>
                      {stepLabels[step.type]}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{step.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
