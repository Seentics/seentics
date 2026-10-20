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
import { useT, type Messages } from '@/lib/i18n';

type RowId = keyof Messages['features'];

/**
 * The four areas in order: where each links and what it shows. Their words (area, a title in two
 * lines broken where the sentence turns, the body and three details) are the language's
 * (`features` in lib/i18n).
 */
export type Row = {
  id: RowId;
  href: string;
  Mock: ComponentType;
};

const ROWS: Row[] = [
  { id: 'analytics', href: '/docs/analytics', Mock: LazyFunnelMock },
  { id: 'replays', href: '/docs/session-replays', Mock: LazyReplayMock },
  { id: 'ai', href: '/websites/demo/ai', Mock: LazyAiModeMock },
  { id: 'automations', href: '/docs/automations', Mock: LazyAutomationBuilderMock },
];

export function FeatureRow({ row }: { row: Row }) {
  const reduce = useReducedMotion();
  const copy = useT().features[row.id];
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
          {copy.area}
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-16">
          <h2 id={`${row.id}-title`} className="lx-display text-[1.75rem] sm:text-4xl">
            {copy.title[0]}
            <br />
            <span>{copy.title[1]}</span>
          </h2>
          <div>
            <p className="lx-dim max-w-md text-base leading-relaxed">{copy.body}</p>
            <Link href={row.href} className="lx-link mt-4">
              {copy.link} <ArrowRight className="h-3.5 w-3.5" />
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
        {copy.details.map((d) => (
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
