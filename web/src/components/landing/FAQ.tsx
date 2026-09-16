'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/stores/useAuthStore';

const FAQS = [
  {
    question: 'Can I self-host Seentics?',
    answer:
      'Yes. The complete platform is open source and can run on your own infrastructure with Docker, Kubernetes or your preferred cloud provider.',
  },
  {
    question: 'Is there a free plan?',
    answer:
      'Yes. Self-hosting is free with no artificial usage limits. Seentics Cloud also includes a free tier, with paid plans for managed hosting and higher event volumes.',
  },
  {
    question: 'How does Seentics protect visitor privacy?',
    answer:
      'Tracking is cookie-free by default, sensitive form values are masked, and self-hosting gives you complete control over where analytics data is stored.',
  },
  {
    question: 'Will the tracking script slow down my site?',
    answer:
      'The tracker loads asynchronously and batches analytics, heatmap and replay data in the background to keep its effect on the page minimal.',
  },
  {
    question: 'Can I access or export raw data?',
    answer:
      'Yes. Use the REST API for raw events and analytics aggregates, or export data for reporting and your existing data pipeline.',
  },
  {
    question: 'How is this different from GA4, Plausible or Hotjar?',
    answer:
      'Those products specialize in individual parts of the journey. Seentics combines analytics, funnels, recordings, heatmaps, AI insights and automations in one self-hostable platform.',
  },
  {
    question: 'Does AI Mode make changes automatically?',
    answer:
      'No. It can answer questions and draft an automation, but you review and approve the proposal before anything is published.',
  },
] as const;

export default function FAQ() {
  const { isAuthenticated } = useAuth();

  return (
    <section id="faq" className="landing-section">
      <div className="landing-container">
        <div className="grid gap-10 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
          <div>
            <p className="landing-eyebrow">FAQ</p>
            <h2 className="landing-h2 mb-4">Questions before you start?</h2>
            <p className="landing-lead max-w-md">
              The essentials about hosting, privacy, pricing and how Seentics works.
            </p>
            <Link href="/docs" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/75">
              Browse all documentation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <Accordion type="single" collapsible className="divide-y divide-border border-y border-border">
            {FAQS.map((faq, index) => (
              <AccordionItem key={faq.question} value={`item-${index}`} className="border-0">
                <AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:no-underline sm:text-lg">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-5 text-[15px] leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-gradient-to-r from-primary/[0.08] to-transparent p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h3 className="landing-h3 mb-2">See your first insights today</h3>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start free, connect a website and keep ownership of your data.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href={isAuthenticated ? '/websites' : '/signup'} className="w-full sm:w-auto">
              <Button className="h-11 w-full rounded-lg px-6 text-base font-semibold sm:w-auto">
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/websites/demo" className="w-full sm:w-auto">
              <Button variant="outline" className="h-11 w-full rounded-lg px-6 text-base font-medium sm:w-auto">
                View Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
