'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Alex Chen',
    role: 'Head of Growth',
    company: 'TechFlow',
    content:
      'Seentics replaced our entire analytics stack. The heatmaps and session recordings gave us insights that drove a 40% lift in conversion within the first quarter.',
    rating: 5,
    initials: 'AC',
  },
  {
    name: 'Sarah Rodriguez',
    role: 'E-commerce Director',
    company: 'ShopSmart',
    content:
      'The privacy-first approach was non-negotiable for us. We got enterprise-grade behavioral insights without compromising on GDPR compliance. Setup took under 10 minutes.',
    rating: 5,
    initials: 'SR',
  },
  {
    name: 'Michael Thompson',
    role: 'VP Marketing',
    company: 'Accelrate',
    content:
      'The automation workflows are a game changer. We now trigger personalized on-site messages based on user behavior — something that previously required three separate tools.',
    rating: 5,
    initials: 'MT',
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-background border-t border-border/40">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
          >
            Customer Stories
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground"
          >
            Trusted by growth teams worldwide
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="flex flex-col p-8 rounded-2xl border border-border/50 bg-card hover:border-border transition-all hover:shadow-lg hover:shadow-primary/5"
            >
              <Quote className="h-5 w-5 text-primary/30 mb-4 flex-shrink-0" />
              <div className="flex items-center gap-0.5 mb-5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">
                &ldquo;{t.content}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.role}, {t.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
