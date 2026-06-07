'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    name: 'Marcus Reid',
    role: 'Head of Product',
    company: 'Fintara',
    avatar: 'MR',
    color: 'bg-blue-600',
    quote:
      'We switched from Mixpanel after our bill hit $2k/month. Seentics gives us session replays, funnels, and analytics in one place — self-hosted on our own infra. Best decision we made.',
  },
  {
    name: 'Sophie Langford',
    role: 'Founder',
    company: 'Launchly',
    avatar: 'SL',
    color: 'bg-violet-600',
    quote:
      'The heatmaps alone changed how we design our landing pages. We spotted a CTA that nobody was scrolling to, moved it up, and conversions jumped 34% the next week.',
  },
  {
    name: 'Daniel Osei',
    role: 'Lead Engineer',
    company: 'Stackform',
    avatar: 'DO',
    color: 'bg-emerald-600',
    quote:
      'Setup took under 10 minutes. The tracker script is tiny, session recordings are clean, and having full data ownership was a non-negotiable for our enterprise clients.',
  },
  {
    name: 'Priya Nair',
    role: 'Growth Manager',
    company: 'Orbify',
    avatar: 'PN',
    color: 'bg-rose-600',
    quote:
      'Finally an analytics tool that doesn\'t require a PhD to set up funnels. We identified our biggest drop-off point in a day and cut churn by 18% within a month.',
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Trusted by product teams
          </h2>
          <p className="text-muted-foreground text-base">
            See why teams are switching from Google Analytics, Mixpanel, and Hotjar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4 shadow-sm"
            >
              <Stars />
              <p className="text-sm text-foreground/80 leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-1 border-t border-border/40">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${t.color}`}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.role} · {t.company}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
