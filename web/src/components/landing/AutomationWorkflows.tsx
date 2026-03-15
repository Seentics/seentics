'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, DoorOpen, Bell, Zap, GitBranch, Send } from 'lucide-react';

const nodeColors = {
  trigger: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    line: 'from-amber-500/40',
  },
  condition: {
    bg: 'bg-indigo-500/10 border-indigo-500/30',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-400',
    line: 'from-indigo-500/40 to-emerald-500/40',
  },
  action: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    line: '',
  },
};

const nodeIcons = {
  trigger: Zap,
  condition: GitBranch,
  action: Send,
};

const workflows = [
  {
    title: 'Recover Abandoned Carts',
    description: 'Automatically message users who leave items in their cart before checking out.',
    steps: [
      { label: 'User drops off at checkout', type: 'trigger' as const },
      { label: 'Cart value is over $100', type: 'condition' as const },
      { label: 'Send a WhatsApp reminder', type: 'action' as const },
    ],
    icon: ShoppingCart,
  },
  {
    title: 'Catch Leaving Visitors',
    description: 'Show a targeted offer the moment someone is about to close the tab.',
    steps: [
      { label: 'Exit intent is detected', type: 'trigger' as const },
      { label: 'Visitor is on pricing page', type: 'condition' as const },
      { label: 'Display a discount popup', type: 'action' as const },
    ],
    icon: DoorOpen,
  },
  {
    title: 'Alert Sales on Hot Leads',
    description: 'Ping your team in Slack when a visitor shows strong buying signals.',
    steps: [
      { label: 'Pricing page is viewed', type: 'trigger' as const },
      { label: 'Visitor spent 3+ minutes', type: 'condition' as const },
      { label: 'Notify #sales in Slack', type: 'action' as const },
    ],
    icon: Bell,
  },
];

function FlowNode({
  step,
  index,
  isLast,
  cardIndex,
}: {
  step: (typeof workflows)[0]['steps'][0];
  index: number;
  isLast: boolean;
  cardIndex: number;
}) {
  const colors = nodeColors[step.type];
  const Icon = nodeIcons[step.type];
  const delay = cardIndex * 0.15 + index * 0.2 + 0.3;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay }}
        className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border ${colors.bg}`}
      >
        {/* Left dot connector */}
        <div className="absolute -left-[7px] top-1/2 -translate-y-1/2">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: delay + 0.1 }}
            className={`h-3.5 w-3.5 rounded-full ${colors.dot} ring-4 ring-card`}
          />
        </div>

        <Icon className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
        <span className={`text-xs font-medium ${colors.text}`}>{step.label}</span>
      </motion.div>

      {/* Connector line */}
      {!isLast && (
        <div className="flex items-center pl-[6px] h-6">
          <motion.div
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: delay + 0.15 }}
            className={`w-px h-full bg-gradient-to-b ${colors.line}`}
            style={{ transformOrigin: 'top' }}
          />
        </div>
      )}
    </>
  );
}

export default function AutomationWorkflows() {
  return (
    <section id="automations" className="py-24 md:py-32 bg-background border-t border-border/50">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16 px-4">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
          >
            Automations
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            React to User Behavior Instantly
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Set up simple rules: when something happens on your site, Seentics takes action automatically. No code required.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {workflows.map((workflow, cardIndex) => (
            <motion.div
              key={workflow.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: cardIndex * 0.1 }}
              className="group p-7 rounded-2xl border border-border/50 bg-card hover:border-border transition-all hover:shadow-xl hover:shadow-primary/5 shadow-sm flex flex-col"
            >
              <div className="mb-6">
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-5 group-hover:scale-110 transition-transform">
                  <workflow.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2 tracking-tight">{workflow.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {workflow.description}
                </p>
              </div>

              {/* Flow diagram */}
              <div className="mt-auto pl-3 flex flex-col">
                {workflow.steps.map((step, i) => (
                  <FlowNode
                    key={i}
                    step={step}
                    index={i}
                    isLast={i === workflow.steps.length - 1}
                    cardIndex={cardIndex}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
