'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/stores/useAuthStore';

const FAQS = [
  {
    q: 'Do I need Observability?',
    a: 'No. Analytics is the product, and it works on its own. Observability is there for SaaS teams that also want logs, metrics and traces from their backend, and it comes with every plan at no extra price.',
  },
  {
    q: 'How much does it cost?',
    a: 'Pay-As-You-Go is $15 a month with 500K events, 3K session recordings and 10 GB of observability included. Past that: $0.01 per 1K events, $1 per 1K recordings and $0.25 per GB. Set a monthly spend cap and you are never billed past it.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes: unlimited websites, 20K events and 30 session recordings a month, and 1 GB of logs, traces and metrics. At a limit, collection pauses until the next month. No card needed.',
  },
  {
    q: 'Can I self-host Seentics?',
    a: 'The analytics core, yes. It is open source under AGPL-3.0 and runs on your own servers with no usage limits. Observability runs on Seentics Cloud.',
  },
  {
    q: 'Does it use cookies?',
    a: 'No cookies and no fingerprinting. The tracker keeps one anonymous visitor ID in the browser, and IP addresses are used to find the country and are not stored.',
  },
  {
    q: 'What do I install for Observability?',
    a: 'Send logs, metrics and traces to Seentics over OpenTelemetry. Your analytics tracker is a separate one-line script tag.',
  },
  {
    q: 'Will the tracker slow my site down?',
    a: 'It loads with defer, so it never blocks the page, and it sends data in batches in the background.',
  },
] as const;

export default function FaqCta() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section id="faq" className="landing-section">
        <div className="landing-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(240px,0.6fr)_minmax(0,1.4fr)] lg:gap-16">
            <div>
              <p className="landing-eyebrow">FAQ</p>
              <h2 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-4">Good questions.</h2>
              <Link href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/75">
                Read the docs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <Accordion type="single" collapsible className="divide-y divide-border border-y border-border">
              {FAQS.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index}`} className="border-0">
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:no-underline sm:text-lg">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-2xl pb-5 text-[15px] leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="landing-container">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-center sm:px-12 md:py-16">
            <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 max-w-lg rounded-full bg-primary/25 blur-3xl" />
            <h2 className="relative mx-auto max-w-xl text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
              See everything happening on your website.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-muted-foreground md:text-base">
              Free to start. No credit card. Set up in minutes.
            </p>
            <div className="relative mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link href={isAuthenticated ? '/websites' : '/signup'}>
                <Button size="lg" className="h-11 w-full px-7 text-sm font-semibold sm:w-auto">
                  {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/websites/demo">
                <Button size="lg" variant="outline" className="h-11 w-full px-7 text-sm font-semibold sm:w-auto">
                  View Live Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
