'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { ProductWindow } from './ProductWindow';
import {
  LazyAiModeMock,
  LazyAutomationBuilderMock,
  LazyFunnelMock,
  LazyReplayMock,
} from './mocks/lazy';

type Row = {
  id: string;
  area: string;
  /** Two lines, broken where the sentence turns. */
  title: [string, string];
  body: string;
  link: { label: string; href: string };
  Mock: ComponentType;
  /** The three things in this area worth naming, each in a few words. */
  details: Array<{ name: string; text: string }>;
};

const ROWS: Row[] = [
  {
    id: 'analytics',
    area: 'Analytics and funnels',
    title: ['Every number,', 'with the reason behind it'],
    body: 'Traffic, sources, goals and revenue on one page, in your own time zone. Funnels show the step where people drop out and how that changed since last period.',
    link: { label: 'How analytics works', href: '/docs/analytics' },
    Mock: LazyFunnelMock,
    details: [
      { name: 'Funnels', text: 'The step that loses people, and the sessions behind it.' },
      { name: 'Goals and revenue', text: 'Conversions and orders, each currency kept apart.' },
      { name: 'Custom events', text: 'Anything you track, with its properties, filterable.' },
    ],
  },
  {
    id: 'replays',
    area: 'Replays and heatmaps',
    title: ['Watch the visit.', 'See where they clicked.'],
    body: 'Session replays mark rage clicks, dead clicks and errors on the timeline. Heatmaps lay every click and scroll over the real page, per device.',
    link: { label: 'Session replay docs', href: '/docs/session-replays' },
    Mock: LazyReplayMock,
    details: [
      { name: 'Frustration signals', text: 'Sessions ranked by how hard the visit was.' },
      { name: 'Heatmaps', text: 'Clicks, scroll depth and attention on every page.' },
      { name: 'Masked by default', text: 'What visitors type into fields is masked before it is recorded.' },
    ],
  },
  {
    id: 'ai',
    area: 'Seentics AI',
    title: ['Ask in plain words.', 'Get an answer you can check.'],
    body: 'Seentics AI reads your analytics, replays and heatmaps. It summarises the hardest sessions, flags what changed, and drafts fixes that change nothing until you confirm them.',
    link: { label: 'Try it in the demo', href: '/websites/demo/ai' },
    Mock: LazyAiModeMock,
    details: [
      { name: 'Session summaries', text: 'What happened in a visit, in two sentences.' },
      { name: 'Alerts', text: 'A drop or a spike, noticed before you look.' },
      { name: 'Recommendations', text: 'What to fix first, measured after you do.' },
    ],
  },
  {
    id: 'automations',
    area: 'Automations',
    title: ['Act on what you see,', 'while the visitor is still there'],
    body: 'Show a message, capture a lead or send a webhook when a visitor does something that matters. Triggers, conditions and A/B tests, without code.',
    link: { label: 'Automation docs', href: '/docs/automations' },
    Mock: LazyAutomationBuilderMock,
    details: [
      { name: 'Popups and forms', text: 'Exit intent, scroll depth, time on page.' },
      { name: 'Webhooks and integrations', text: 'Leads delivered where your team works.' },
      { name: 'A/B tests', text: 'Split traffic between versions; each lead records its variant.' },
    ],
  },
];

function FeatureRow({ row }: { row: Row }) {
  const reduce = useReducedMotion();
  // Same props either way (see Hero): reduced motion only takes the duration away.
  const reveal = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: reduce ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <section id={row.id} aria-labelledby={`${row.id}-title`} className="scroll-mt-24 pt-28 sm:pt-40">
      <motion.div {...reveal}>
        <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--lx-text)' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          {row.area}
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <h2 id={`${row.id}-title`} className="lx-display text-[1.75rem] sm:text-4xl">
            {row.title[0]}
            <br />
            <span>{row.title[1]}</span>
          </h2>
          <div>
            <p className="lx-dim max-w-md text-base leading-relaxed">{row.body}</p>
            <Link href={row.link.href} className="lx-link mt-4">
              {row.link.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </motion.div>

      <motion.div {...reveal} className="mt-12 sm:mt-16">
        <ProductWindow designWidth={1280} designHeight={800}>
          <row.Mock />
        </ProductWindow>
      </motion.div>

      <dl className="mt-10 grid gap-x-8 gap-y-6 border-t pt-8 sm:grid-cols-3" style={{ borderColor: 'var(--lx-line)' }}>
        {row.details.map((d) => (
          <div key={d.name}>
            <dt className="text-[15px] font-medium" style={{ color: 'var(--lx-text)' }}>{d.name}</dt>
            <dd className="lx-dim mt-1 text-[15px] leading-relaxed">{d.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function FeatureRows() {
  return (
    <div className="lx-container">
      {ROWS.map((row) => (
        <FeatureRow key={row.id} row={row} />
      ))}
    </div>
  );
}
