'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQS = [
  {
    q: 'Do I need Observability?',
    a: 'No. Analytics is the product, and it works on its own. Observability is there for SaaS teams that also want logs, metrics and traces from their backend, and it comes with every plan at no extra price.',
  },
  {
    q: 'How much does it cost?',
    a: 'Every plan has the whole product, and they differ by how much. Free is $0 with up to 20K events and 300 session recordings a month. Starter is $9 a month for up to 200K events, 1,500 recordings and 5 GB of logs, traces and metrics. Pro is $24 a month for up to 1M events, 5K recordings and 30 GB. Need more on Pro? Turn on extra usage from Billing: $0.01 per 1K events, $2 per 1K recordings and $0.25 per GB, with a monthly spend cap you set.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes: unlimited websites, 20K events and 300 session recordings a month, and 3 GB of logs, traces and metrics. At a limit, collection pauses until the next month. No card needed.',
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
  return (
    <>
      <section id="faq" className="landing-section">
        <div className="landing-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(240px,0.6fr)_minmax(0,1.4fr)] lg:gap-16">
            <div>
              <h2 className="lx-display mb-4 text-[1.75rem] sm:text-4xl">Questions</h2>
              <Link href="/docs" className="lx-link">
                Read the docs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <Accordion type="single" collapsible className="divide-y divide-border border-y border-border">
              {FAQS.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index}`} className="border-0">
                  <AccordionTrigger className="py-5 text-left text-base font-medium text-foreground hover:no-underline sm:text-[17px]">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-2xl pb-5 text-[15px] leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

    </>
  );
}
