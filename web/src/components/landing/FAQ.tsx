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
];

export default function FAQ() {
  const { isAuthenticated } = useAuth();

  return (
    <section id="faq" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
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
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
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

        <div className="max-w-2xl mx-auto mb-20">
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <AccordionItem
                  value={`item-${index}`}
                  className="border border-border/50 rounded-lg px-5 overflow-hidden bg-card"
                >
                  <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-xl mx-auto text-center py-16 border-t border-border/40"
        >
          <h3 className="text-2xl font-bold tracking-tight text-foreground mb-3">
            Ready to build with analytics APIs?
          </h3>
          <p className="text-muted-foreground mb-6">
            Get API access. Explore our SDKs and components. Deploy self-hosted. Full developer control.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={isAuthenticated ? '/websites' : '/signup'}>
              <Button className="h-10 px-6 text-sm font-medium rounded-lg">
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs/api">
              <Button variant="outline" className="h-10 px-6 text-sm font-medium rounded-lg">
                API Docs
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4">
            Open Source &middot; Self-Hosted &middot; APIs &amp; SDKs &middot; Full Data Access
          </p>
        </motion.div>
      </div>
    </section>
  );
}
