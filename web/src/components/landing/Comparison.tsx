'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

export default function Comparison() {
  const comparisons = [
    { name: 'Real-time Dashboard', seentics: true, ga: true, hotjar: false, plausible: true },
    { name: 'UTM Campaign Tracking', seentics: true, ga: true, hotjar: false, plausible: true },
    { name: 'Conversion Funnels', seentics: true, ga: true, hotjar: true, plausible: true },
    { name: 'Goal Tracking', seentics: true, ga: true, hotjar: false, plausible: true },
    { name: 'Geographic Map View', seentics: true, ga: true, hotjar: false, plausible: false },
    { name: 'Privacy-First (No Cookies)', seentics: true, ga: false, hotjar: false, plausible: true },
    { name: 'Self-Hostable (Open Source)', seentics: true, ga: false, hotjar: false, plausible: true },
    { name: 'Lightweight Script (<2KB)', seentics: true, ga: false, hotjar: false, plausible: true },
  ];

  return (
    <section id="comparison" className="py-24 md:py-32 bg-background border-t border-border/50">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
          >
            Comparison
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Seentics vs. the Rest
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-xl mx-auto"
          >
            See how Seentics stacks up against other analytics tools.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-x-auto rounded-xl border border-border/50 bg-card"
        >
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="border-b border-border/60">
                <th className="py-6 px-8 text-left text-xs font-black uppercase tracking-widest text-muted-foreground/60 w-1/3">Capabilities</th>
                <th className="px-6 py-6 text-sm font-bold text-primary bg-primary/5 border-x border-primary/10">
                  <div className="flex flex-col items-center gap-2">
                    <Logo size="sm" />
                    <span className="tracking-tighter uppercase font-black">Seentics</span>
                  </div>
                </th>
                <th className="px-6 py-6 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 w-1/6">
                  <div className="flex flex-col items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    <img src="/images/competitor/ga4.avif" alt="Google Analytics" className="h-6 w-auto object-contain grayscale brightness-125" />
                    <span className="text-[10px]">GA4</span>
                  </div>
                </th>
                <th className="px-6 py-6 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 w-1/6">
                  <div className="flex flex-col items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    <img src="/images/competitor/hotjar.png" alt="Hotjar" className="h-6 w-auto object-contain grayscale brightness-125" />
                    <span className="text-[10px]">Hotjar</span>
                  </div>
                </th>
                <th className="px-6 py-6 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 w-1/6">
                  <div className="flex flex-col items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                    <img src="/images/competitor/plausible.jpeg" alt="Plausible" className="h-6 w-auto object-contain rounded-sm grayscale brightness-125" />
                    <span className="text-[10px]">Plausible</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {comparisons.map((item) => (
                <tr key={item.name} className="hover:bg-muted/30 transition-colors group">
                  <td className="py-5 px-8 text-left text-sm font-semibold text-foreground tracking-tight">
                    {item.name}
                  </td>
                  <td className="px-6 py-5 text-primary bg-primary/5 border-x border-primary/10">
                    <div className="flex justify-center">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-muted-foreground/40">
                    <div className="flex justify-center">
                      {item.ga ? <Check className="h-4 w-4 text-emerald-500/60" /> : <X className="h-3.5 w-3.5 opacity-30" />}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-muted-foreground/40">
                    <div className="flex justify-center">
                      {item.hotjar ? <Check className="h-4 w-4 text-emerald-500/60" /> : <X className="h-3.5 w-3.5 opacity-30" />}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-muted-foreground/40">
                    <div className="flex justify-center">
                      {item.plausible ? <Check className="h-4 w-4 text-emerald-500/60" /> : <X className="h-3.5 w-3.5 opacity-30" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <div className="mt-16 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <a
              href="/signup"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline group decoration-primary/30 underline-offset-4"
            >
              Start using Seentics for free
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
