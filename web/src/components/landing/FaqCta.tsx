'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useT } from '@/lib/i18n';

/** The landing page's questions (`faq` in lib/i18n). */

export default function FaqCta() {
  const t = useT();
  const faqs = t.faq.items;
  return (
    <>
      <section id="faq" className="landing-section">
        <div className="landing-container">
          <div className="grid gap-10 lg:grid-cols-[minmax(240px,0.6fr)_minmax(0,1.4fr)] lg:gap-16">
            <div>
              <h2 className="lx-display mb-4 text-[1.75rem] sm:text-4xl">{t.faq.title}</h2>
              <Link href="/docs" className="lx-link">
                {t.faq.readDocs}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <Accordion type="single" collapsible className="divide-y divide-border border-y border-border">
              {faqs.map((item, index) => (
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
