import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * What people use it for, as the questions they actually ask. Text only: a big question on the left,
 * the answer and the feature behind it on the right, divided by thin rules. No previews, no cards.
 */
const QUESTIONS = [
  {
    question: 'Why do visitors leave my pricing page?',
    answer: 'Build a funnel and see the exact step that loses people, then open the sessions behind it.',
    feature: 'Funnels',
  },
  {
    question: 'Is my signup form broken?',
    answer: 'Watch real sessions with rage clicks and console errors on the same timeline. Inputs stay masked.',
    feature: 'Session replay',
  },
  {
    question: 'What do people ignore on my homepage?',
    answer: 'See where visitors click and how far they scroll, on every page and device.',
    feature: 'Heatmaps',
  },
  {
    question: 'Can I win back someone who is about to leave?',
    answer: 'Catch exit intent or an abandoned form and respond with a message, a redirect or a webhook. No code.',
    feature: 'Automations',
  },
] as const;

export default function ProductInAction() {
  return (
    <section id="product" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto max-w-4xl">
          <p className="landing-eyebrow mb-8">Questions Seentics answers</p>
          <ul className="divide-y divide-border border-y border-border">
            {QUESTIONS.map((item) => (
              <li key={item.feature} className="grid gap-3 py-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-12 md:py-10">
                <h3 className="text-balance text-2xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
                  {item.question}
                </h3>
                <div>
                  <p className="text-base leading-relaxed text-muted-foreground">{item.answer}</p>
                  <span className="mt-3 inline-block text-sm font-semibold text-primary">{item.feature}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center">
            <Link href="/websites/demo" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/75">
              See all of it in the live demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
