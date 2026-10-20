'use client';

import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';

/**
 * What the product is for, then the three things that are true of all of it. The figures
 * are line drawings in the page's own ink, so they follow the theme.
 */

const stroke = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' as const };

/** Visitors as dots; the ones counted anonymously are hollow. */
function FigPrivacy() {
  const dots = Array.from({ length: 7 * 4 }, (_, i) => ({ x: 22 + (i % 7) * 26, y: 24 + Math.floor(i / 7) * 26, hollow: i % 3 !== 0 }));
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      {dots.map((d, i) =>
        d.hollow ? (
          <circle key={i} cx={d.x} cy={d.y} r={4.5} {...stroke} className="lx-faint" />
        ) : (
          <circle key={i} cx={d.x} cy={d.y} r={4.5} fill="currentColor" className="lx-dim" />
        ),
      )}
    </svg>
  );
}

/** One tag, fanning out to everything it collects. */
function FigScript() {
  const ends = [18, 46, 74, 102];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <rect x={14} y={48} width={52} height={24} rx={6} {...stroke} className="lx-dim" />
      <text x={40} y={64} textAnchor="middle" className="lx-mono" fill="currentColor" style={{ fontSize: 10 }}>&lt;/&gt;</text>
      {ends.map((y) => (
        <g key={y} className="lx-faint">
          <path d={`M66 60 C 110 60, 110 ${y}, 150 ${y}`} {...stroke} />
          <circle cx={156} cy={y} r={5} {...stroke} />
        </g>
      ))}
      <circle cx={156} cy={ends[1]} r={5} fill="hsl(var(--primary))" />
    </svg>
  );
}

/** The same product, in our cloud or on your own servers. */
function FigOpen() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={30 + i * 10} y={70 - i * 22} width={90} height={30} rx={5} {...stroke} className={i === 2 ? 'lx-dim' : 'lx-faint'} />
      ))}
      <rect x={140} y={46} width={44} height={52} rx={5} {...stroke} className="lx-faint" strokeDasharray="3 3" />
      <path d="M126 72 H 138" {...stroke} className="lx-faint" />
    </svg>
  );
}

/** The figures in order; their titles and text are the language's (`statement.figures`). */
const FIGURES: Array<{ fig: string; art: ReactNode }> = [
  { fig: 'Fig 0.1', art: <FigPrivacy /> },
  { fig: 'Fig 0.2', art: <FigScript /> },
  { fig: 'Fig 0.3', art: <FigOpen /> },
];

export default function Statement() {
  const t = useT();
  return (
    <section className="lx-container pt-28 sm:pt-40">
      <p className="lx-heading max-w-[44rem] text-xl sm:text-2xl">
        {t.statement.lead}{' '}
        <span className="lx-dim">{t.statement.rest}</span>
      </p>

      <div className="mt-16 grid border-t sm:grid-cols-3" style={{ borderColor: 'var(--lx-line)' }}>
        {FIGURES.map((f, i) => (
          <article
            key={f.fig}
            className={`py-10 sm:px-8 ${i === 0 ? 'sm:pl-0' : 'border-t sm:border-l sm:border-t-0'} ${i === 2 ? 'sm:pr-0' : ''}`}
            style={{ borderColor: 'var(--lx-line)' }}
          >
            <div className="h-28" aria-hidden>{f.art}</div>
            <p className="lx-mono lx-faint mt-8 uppercase">{f.fig}</p>
            <h3 className="lx-heading mt-2 text-lg">{t.statement.figures[i]?.title}</h3>
            <p className="lx-dim mt-2 text-[15px] leading-relaxed">{t.statement.figures[i]?.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
