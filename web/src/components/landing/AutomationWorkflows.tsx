'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MousePointer2, Globe, AlertCircle } from 'lucide-react';

const workflows = [
  {
    title: 'Smarter Retargeting',
    description: 'Convert leaving visitors with timely offers that match their browsing intent.',
    steps: [
      { label: 'Exit intent detected', type: 'trigger' },
      { label: 'Cart value > $100', type: 'condition' },
      { label: 'Show discount modal', type: 'action' },
    ],
    icon: MousePointer2,
  },
  {
    title: 'Enterprise Lead Sync',
    description: 'Alert your sales team instantly when a high-value prospect visits pricing.',
    steps: [
      { label: 'Pricing page visit', type: 'trigger' },
      { label: 'Enterprise IP match', type: 'condition' },
      { label: 'Notify #sales on Slack', type: 'action' },
    ],
    icon: Globe,
  },
  {
    title: 'Proactive Support',
    description: 'Identify frustrated users from rage clicks and offer help before they leave.',
    steps: [
      { label: 'Rage clicks detected', type: 'trigger' },
      { label: 'Paying customer', type: 'condition' },
      { label: 'Open live chat widget', type: 'action' },
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
    <section id="automations" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-16">
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

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {workflows.map((workflow, index) => (
            <motion.div
              key={workflow.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="rounded-xl border border-border/50 bg-card p-6 flex flex-col"
            >
              <div className="mb-5">
                <workflow.icon className="h-5 w-5 text-foreground mb-3" />
                <h3 className="text-base font-semibold text-foreground mb-1.5">{workflow.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {workflow.description}
                </p>
              </div>

              <div className="space-y-2 mt-auto">
                {workflow.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-semibold w-12 text-center py-1 rounded ${stepColors[step.type]}`}>
                      {stepLabels[step.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">{step.label}</span>
                    {i < workflow.steps.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-border ml-auto flex-shrink-0" />
                    )}
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
