'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MacbookFrame } from './mocks/MacbookFrame';
import {
  LazyAutomationBuilderMock,
  LazyFunnelMock,
  LazyHeatmapMock,
  LazyReplayMock,
} from './mocks/lazy';

/**
 * One section per capability: the claim on one side, the screen that backs it on the
 * other.
 *
 * This replaces the three feature cards that used to list every capability as bullet
 * text. A list asks you to believe the product exists; a shot of the automation
 * builder — the actual builder, node for node — shows it. So each row gets a real
 * screen, and the copy shrinks to the one sentence the screen cannot say itself.
 *
 * Sides alternate, and the mock column is the wider of the two: the text is three
 * lines and a list, the screen needs every pixel it can get to stay legible once
 * scaled. Below `lg` the screen keeps a fixed width and the row scrolls sideways.
 */

/** Mocks are 16:10 laptop screens laid out at 1100px — see `MacbookFrame`. */
const MOCK_W = 1100;
const MOCK_H = 688;

type Feature = {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead: string;
  points: string[];
  href: string;
  linkLabel: string;
  /** The route this screen lives at — shown in the mock's address bar. */
  url: string;
  mock: ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: 'automations',
    eyebrow: 'Automations',
    title: (
      <>
        See a behavior. <span className="landing-accent">Act on it.</span>
      </>
    ),
    lead:
      'Drag a trigger onto the canvas, branch on whatever you know about the visitor, and connect the action that should follow. No tags to deploy, no code to ship.',
    points: [
      'Exit intent, scroll depth, rage clicks, custom events',
      'Branch with if/else, switch, wait-until and delays',
      'Popups, banners, tooltips, redirects and webhooks',
      'Rate limits, cooldowns and A/B variants built in',
    ],
    href: '/docs/automations',
    linkLabel: 'How automations work',
    url: 'app.seentics.com/websites/acme-store/automations/exit-offer',
    mock: <LazyAutomationBuilderMock />,
  },
  {
    id: 'funnels',
    eyebrow: 'Funnels',
    title: (
      <>
        Find the step that <span className="landing-accent">loses people.</span>
      </>
    ),
    lead:
      'Define the path you expect visitors to take, then watch where they leave it. Every step carries its own hit count and drop-off, so the weak link is the one you can see.',
    points: [
      'Page and event steps, in any order you like',
      'Per-step drop-off counts and conversion rates',
      'Compare across date ranges and segments',
      'Jump straight from a drop-off to the recordings behind it',
    ],
    href: '/docs/funnels',
    linkLabel: 'Read the funnels guide',
    url: 'app.seentics.com/websites/acme-store/funnels/main-conversion-path',
    mock: <LazyFunnelMock />,
  },
  {
    id: 'replays',
    eyebrow: 'Session Recordings',
    title: (
      <>
        Watch the session behind <span className="landing-accent">the number.</span>
      </>
    ),
    lead:
      'A drop-off is a question; the recording is the answer. Replay the real session with the console, the network log and the errors on the same timeline.',
    points: [
      'Full DOM replay — no video, no blurry screenshots',
      'Console, network and JS errors alongside the player',
      'Rage clicks and dead clicks flagged on the timeline',
      'Inputs masked by default, GDPR-ready',
    ],
    href: '/docs/analytics',
    linkLabel: 'See what gets recorded',
    url: 'app.seentics.com/websites/acme-store/replays/sess_8f2c41ab9de07',
    mock: <LazyReplayMock />,
  },
  {
    id: 'heatmaps',
    eyebrow: 'Heatmaps',
    title: (
      <>
        See what the page <span className="landing-accent">actually gets clicked.</span>
      </>
    ),
    lead:
      'Click and scroll maps rendered over the page itself, so "nobody sees the second CTA" stops being a hunch and becomes something you can point at.',
    points: [
      'Click maps over a live screenshot of the page',
      'Scroll depth — where attention stops',
      'Split by desktop, mobile and tablet',
      'Any page, no per-page setup',
    ],
    href: '/docs/analytics',
    linkLabel: 'Explore heatmaps',
    url: 'app.seentics.com/websites/acme-store/heatmaps/pricing',
    mock: <LazyHeatmapMock />,
  },
];

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  // Every row carries the two-tone band; the direction flips row to row so the
  // sloped divide zigzags down the page rather than repeating the same fall.
  const mockFirst = index % 2 === 1;

  return (
    <section
      id={feature.id}
      className={cn(
        'landing-section landing-band',
        index % 2 === 1 && 'landing-band-reverse',
      )}
    >
      <div className="landing-container">
        <div
          className={cn(
            'grid items-center gap-10 xl:gap-16',
            // The tracks flip with the sides, they are not just reordered. `order`
            // alone moved the mock visually but grid auto-placement then put it in
            // whichever track came first — so on reversed rows the screen landed in
            // the narrow column and shrank by a third.
            mockFirst
              ? 'xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'
              : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]',
          )}
        >
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className={cn('min-w-0 max-w-2xl', mockFirst && 'xl:col-start-2 xl:row-start-1')}
          >
            {/* No icon tile. Four rows each carried one, and since they had to share a
                single neutral treatment to stop the page turning into a colour chart,
                they stopped distinguishing anything — four identical grey squares
                above four different words. The label does that job on its own. */}
            <p className="landing-eyebrow">{feature.eyebrow}</p>

            <h2 className="landing-h2 mb-5">{feature.title}</h2>

            <p className="landing-lead mb-8">{feature.lead}</p>

            <ul className="space-y-3.5">
              {feature.points.map((point) => (
                <li key={point} className="landing-body flex items-start gap-3 text-foreground/90">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {/* A real control, not an inline link. Outlined rather than filled: four
                solid primary buttons down the page would each compete with the hero's. */}
            <Link
              href={feature.href}
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-lg border-2 border-border px-6 text-[15px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {feature.linkLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/*
            Screen. It scales to whatever column it gets, phone included — so on a
            390px screen the laptop is small and the labels inside it are not really
            readable. That is the deliberate trade: a complete, correctly-proportioned
            shot of the product at a glance beats either hiding it or making the page
            scroll sideways to read it.
          */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={cn('min-w-0', mockFirst && 'xl:col-start-1 xl:row-start-1')}
          >
            <MacbookFrame designWidth={MOCK_W} designHeight={MOCK_H} url={feature.url}>
              {feature.mock}
            </MacbookFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function FeatureSections() {
  return (
    <div id="features">
      {FEATURES.map((feature, i) => (
        <FeatureRow key={feature.id} feature={feature} index={i} />
      ))}
    </div>
  );
}
