import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

const faqs = [
  {
    question: 'Is it really free?',
    answer:
      'Yes. Our Starter plan is 100% free for a single website. No credit card required. We believe high-quality analytics should be accessible to everyone.',
  },
  {
    question: 'Will it slow down my site?',
    answer:
      "No. Our script is under 2KB — it's designed for performance and won't affect your page load speed or SEO.",
  },
  {
    question: 'Is my data safe and private?',
    answer:
      "Absolutely. We don't use cookies or collect personal data. Everything is built to be private and compliant with GDPR, CCPA, and PECR.",
  },
  {
    question: 'Can I import from Google Analytics?',
    answer:
      "Yes. We have a simple import tool for Google Analytics (UA or GA4) so you don't lose your history.",
  },
  {
    question: 'Do you offer custom plans?',
    answer:
      'We do. For high-volume sites or specific needs, we offer custom infrastructure and volume discounts. Contact us to learn more.',
  },
];

export default function FAQ() {
  const { isAuthenticated } = useAuth();

  return (
    <section id="faq" className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
          >
            Frequently asked questions
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-muted-foreground text-lg"
          >
            Everything you need to know to get started.
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
            Ready to get started?
          </h3>
          <p className="text-muted-foreground mb-6">
            Join hundreds of businesses using Seentics for privacy-friendly analytics.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={isAuthenticated ? '/websites' : '/signup'}>
              <Button className="h-10 px-6 text-sm font-medium rounded-lg">
                {isAuthenticated ? 'Go to Dashboard' : 'Start for Free'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/websites/demo">
              <Button variant="outline" className="h-10 px-6 text-sm font-medium rounded-lg">
                View Live Demo
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-4">
            No credit card required &middot; GDPR compliant &middot; Setup in 2 minutes
          </p>
        </motion.div>
      </div>
    </section>
  );
}
