import { motion } from 'framer-motion';
import { BarChart3, Shield, Filter, Play, MousePointer2, Workflow } from 'lucide-react';
import React from 'react';

const features = [
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'See who is on your site right now. Pageviews, visitors, referrers, and custom events with sub-second latency.',
  },
  {
    icon: MousePointer2,
    title: 'Heatmaps',
    description: 'Visualize where users click, scroll, and move. Understand engagement patterns on every page.',
  },
  {
    icon: Play,
    title: 'Session Recordings',
    description: 'Watch real user sessions to understand behavior, debug issues, and improve the experience.',
  },
  {
    icon: Filter,
    title: 'Conversion Funnels',
    description: 'Build multi-step funnels to identify where users drop off and optimize your conversion path.',
  },
  {
    icon: Workflow,
    title: 'Automations',
    description: 'Trigger emails, webhooks, and on-site actions based on user behavior and events.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'No cookies by default. PII masking built in. Fully GDPR, CCPA, and PECR compliant.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Everything you need, nothing you don't
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-muted-foreground text-lg"
          >
            One platform replaces your entire analytics stack. No integrations, no extra costs.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/50 border border-border/50 rounded-xl overflow-hidden max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="p-8 bg-background hover:bg-muted/30 transition-colors"
            >
              <feature.icon className="h-5 w-5 text-foreground mb-4" />
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
