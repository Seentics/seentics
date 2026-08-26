'use client';

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

const faqs = [
  {
    question: 'Can I access raw event data via API?',
    answer:
      'Yes. Our REST API gives you access to all raw event data, analytics aggregates, funnels, and more. Perfect for building custom reports or integrating with your data pipeline.',
  },
  {
    question: 'Do you provide SDKs and React components?',
    answer:
      'Yes. We provide JavaScript/TypeScript SDK, React hooks, and pre-built UI components for charts and dashboards. Drop them into your app or build your own using our APIs.',
  },
  {
    question: 'Can I self-host this on my own servers?',
    answer:
      'Absolutely. Seentics is open source. Deploy to your own infrastructure, on Kubernetes, Docker, or any cloud provider. You own everything.',
  },
  {
    question: 'How do I track custom events programmatically?',
    answer:
      'Use our JavaScript SDK or HTTP API to track custom events from your frontend or backend. No limitations — track whatever you need.',
  },
  {
    question: 'Can I build a completely custom dashboard?',
    answer:
      'Yes. Access our APIs to query any data, then build custom dashboards with your own design system. Full control over the experience.',
  },
  {
    question: 'What about data privacy and GDPR?',
    answer:
      'No cookies, no personal data collection by default. GDPR and CCPA compliant. When self-hosted, you have complete control over compliance.',
  },
  {
    question: 'Is there a free plan?',
    answer:
      'Yes. The open-source version is free forever when you self-host — no limits you don’t set yourself. Our cloud plans add managed hosting, higher quotas, and support, with a free tier to get started.',
  },
  {
    question: 'Will the tracking script slow down my site?',
    answer:
      'No. The tracker is a tiny, async-loaded script that runs off the main thread and adds negligible weight. Analytics, heatmaps, and replays are batched and sent in the background.',
  },
  {
    question: 'How is Seentics different from GA4, Plausible or Hotjar?',
    answer:
      'Those tools each solve one piece — analytics, privacy, or recordings. Seentics unifies analytics, session replays, heatmaps, funnels, AI insights, and automations in one open-source, self-hostable platform.',
  },
  {
    question: 'Can I invite my team?',
    answer:
      'Yes. Add teammates with role-based access so everyone works from the same data. Seat limits depend on your plan, and self-hosting has no artificial cap.',
  },
  {
    question: 'What happens to my data if I cancel?',
    answer:
      'Your data is always yours. Export everything via CSV or the API at any time, and if you self-host it never leaves your servers in the first place.',
  },
];

export default function FAQ() {
  const { isAuthenticated } = useAuth();

  return (
    // Only a top border: the footer's own border-t closes this band, and a
    // border-y here would stack against it into a 2px rule.
    <section id="faq" className="py-24 md:py-32 border-t border-border bg-muted/50 dark:border-transparent dark:bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-xs font-semibold uppercase tracking-widest text-primary mb-3"
          >
            FAQ
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter text-foreground mb-4 leading-[1.05]"
          >
            Frequently asked questions
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-muted-foreground text-lg"
          >
            Everything you need to know before getting started.
          </motion.p>
        </div>

        <div className="max-w-3xl mx-auto mb-16">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <AccordionItem
                  value={`item-${index}`}
                  className="rounded-lg border border-border bg-card px-5 shadow-sm transition-colors data-[state=open]:border-primary/30 data-[state=open]:bg-primary/[0.03] dark:border-border/60"
                >
                  <AccordionTrigger className="py-4 text-left text-base font-semibold text-foreground hover:no-underline sm:text-lg">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 text-[15px] leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-card bg-gradient-to-b from-primary/[0.07] to-transparent px-6 py-12 text-center shadow-sm dark:border-border/60 dark:bg-transparent dark:shadow-none sm:px-12"
        >
          <h3 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Still have questions?
          </h3>
          <p className="mx-auto mb-7 max-w-md text-muted-foreground">
            Start free and own your analytics — open source, self-hosted, no credit card required.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={isAuthenticated ? '/websites' : '/signup'} className="w-full sm:w-auto">
              <Button className="h-11 w-full rounded-lg px-6 text-base font-semibold sm:w-auto">
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs" className="w-full sm:w-auto">
              <Button variant="outline" className="h-11 w-full rounded-lg px-6 text-base font-medium sm:w-auto">
                Read the Docs
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-xs text-muted-foreground/60">
            Open source &middot; Self-hosted &middot; No cookies &middot; GDPR-ready
          </p>
        </motion.div>
      </div>
    </section>
  );
}
