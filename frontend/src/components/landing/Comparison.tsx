'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Sparkles } from 'lucide-react';

export default function Comparison() {
  const comparisons = [
    {
      title: 'All-in-One Platform',
      seentics: 'Analytics + Heatmaps + Funnels + Automations',
      others: 'Need 3-4 different tools'
    },
    {
      title: 'Privacy & GDPR',
      seentics: 'No cookies, fully compliant',
      others: 'Cookie banners required'
    },
    {
      title: 'Real-time Analytics',
      seentics: 'Live visitor tracking included',
      others: 'Often delayed or limited'
    },
    {
      title: 'Web Performance',
      seentics: 'Core Web Vitals monitoring',
      others: 'Limited or not included'
    },
    {
      title: 'Visual Heatmaps',
      seentics: 'Built-in click & scroll maps',
      others: 'Separate tool needed ($39+/mo)'
    },
    {
      title: 'Automated Workflows',
      seentics: 'Trigger actions based on behavior',
      others: 'Not available in analytics tools'
    },
    {
      title: 'Pricing',
      seentics: 'Starting at $9/month',
      others: 'Often $30-100+/month per tool'
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold uppercase tracking-wider mb-6">
            <Sparkles className="h-4 w-4" />
            Why Choose Us
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            One Platform. Everything Included.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stop paying for multiple tools. Get everything you need in one place.
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className="grid gap-6 mb-12">
          {comparisons.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-card rounded-xl border border-border/50 shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="grid md:grid-cols-3 gap-6 p-6 items-center">
                {/* Feature Title */}
                <div>
                  <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                </div>
                
                {/* Seentics */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <Check className="h-5 w-5 text-emerald-500" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary mb-1">Seentics</p>
                    <p className="text-sm text-foreground">{item.seentics}</p>
                  </div>
                </div>

                {/* Others */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <X className="h-5 w-5 text-muted-foreground/40" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-muted-foreground mb-1">Other Tools</p>
                    <p className="text-sm text-muted-foreground">{item.others}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 p-8 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
            <div>
              <p className="text-xl font-bold text-foreground mb-2">
                Save time and money with one complete solution
              </p>
              <p className="text-sm text-muted-foreground">
                Join thousands of businesses already using Seentics
              </p>
            </div>
            <a
              href="/signup"
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-bold text-base hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 whitespace-nowrap"
            >
              Start Free Trial
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
