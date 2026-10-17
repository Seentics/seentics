'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const AGENCY_FAQS = [
  {
    q: 'Can my clients log in?',
    a: 'Not yet. Client sign-in, with the pages you choose, is coming soon. Today you can share an embedded dashboard or a report.',
  },
  {
    q: 'Can I use my own domain?',
    a: 'You can connect it now from Branding & domain. Serving client dashboards on it is coming soon.',
  },
  {
    q: 'What counts as an event?',
    a: 'Every pageview and every custom event you send. Recordings are counted separately. Usage is pooled across all your clients.',
  },
  {
    q: 'Can I move a site to another client?',
    a: 'Yes. Move any website between clients, or out of one, at any time. Its data stays with it.',
  },
  {
    q: 'Is there an API?',
    a: 'Yes. The agency API creates clients, adds websites and reads usage, with an account API key.',
  },
] as const;

export function AgencyFaq() {
  return (
    <section id="faq" className="landing-section">
      <div className="landing-container">
        <div className="grid gap-10 lg:grid-cols-[minmax(240px,0.6fr)_minmax(0,1.4fr)] lg:gap-16">
          <div>
            <h2 className="lx-display mb-4 text-[1.75rem] sm:text-4xl">Questions</h2>
            <Link href="/docs/agency/api" className="lx-link">
              Agency API docs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <Accordion type="single" collapsible className="divide-y divide-border border-y border-border">
            {AGENCY_FAQS.map((item, index) => (
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
  );
}
