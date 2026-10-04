'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BarChart3, Check, Filter, MousePointer2, PlayCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MacbookFrame } from './mocks/MacbookFrame';
import { DashboardMock } from './mocks/DashboardMock';
import {
  LazyAutomationBuilderMock,
  LazyFunnelMock,
  LazyHeatmapMock,
  LazyReplayMock,
} from './mocks/lazy';

/**
 * "What do you actually get?", answered by letting the visitor click through it.
 *
 * One tab per capability: the pitch and the questions it answers on the left, the real
 * screen on the right. `core` capabilities ship on every plan; the rest are optional —
 * switch them on when you need them, so a visitor who only wants analytics can see
 * that is a complete product on its own.
 *
 * The tabs auto-advance until the visitor touches them (or the section leaves the
 * viewport), then stay where they put them.
 */
const TABS = [
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    core: true,
    title: 'Know what is working, in real time',
    description: 'Cookie-free traffic analytics: sources, pages, devices, countries and campaigns on one screen.',
    points: ['Live visitors and realtime events', 'Sources, UTM campaigns and referrers', 'Goals, revenue and attribution'],
    href: '/docs/analytics',
    url: 'app.seentics.com/websites/acme-store',
    Mock: DashboardMock,
  },
  {
    id: 'funnels',
    label: 'Funnels',
    icon: Filter,
    core: true,
    title: 'Find the step that loses people',
    description: 'Build a funnel from pages or events and open the exact sessions behind every drop-off.',
    points: ['Page and custom-event steps', 'Segment by source, device or country', 'Jump from a drop-off to its recordings'],
    href: '/docs/funnels',
    url: 'app.seentics.com/websites/acme-store/funnels/checkout',
    Mock: LazyFunnelMock,
  },
  {
    id: 'replay',
    label: 'Session replay',
    icon: PlayCircle,
    core: false,
    title: 'Watch what visitors actually did',
    description: 'Replays with console, network and JavaScript errors on the same timeline. Inputs are masked by default.',
    points: ['Rage-click and dead-click detection', 'Errors pinned to the moment they happened', 'Sensitive fields never leave the browser'],
    href: '/docs/session-replays',
    url: 'app.seentics.com/websites/acme-store/replays',
    Mock: LazyReplayMock,
  },
  {
    id: 'heatmaps',
    label: 'Heatmaps',
    icon: MousePointer2,
    core: false,
    title: 'See where attention stops',
    description: 'Click maps and scroll depth for every page, split by desktop, tablet and mobile.',
    points: ['Click and scroll maps per page', 'Compare devices side by side', 'Switch it on per website, no code changes'],
    href: '/docs/heatmaps',
    url: 'app.seentics.com/websites/acme-store/heatmaps',
    Mock: LazyHeatmapMock,
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Zap,
    core: false,
    title: 'Act the moment behavior happens',
    description: 'Catch exit intent, rage clicks or an abandoned form and respond with a message, redirect or webhook.',
    points: ['Visual builder, no deploys', 'Delays, conditions and rate limits', 'Webhooks into your own stack'],
    href: '/docs/automations',
    url: 'app.seentics.com/websites/acme-store/automations/exit-offer',
    Mock: LazyAutomationBuilderMock,
  },
] as const;

const ADVANCE_MS = 6000;

export default function ProductExplorer() {
  const reduceMotion = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduceMotion || touched || !visible) return;
    const timer = setTimeout(() => setActive((i) => (i + 1) % TABS.length), ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [active, reduceMotion, touched, visible]);

  const tab = TABS[active];

  return (
    <section id="explore" ref={section} className="landing-section landing-band">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="landing-eyebrow">What you get</p>
          <h2 className="landing-h2 mb-4">Start with analytics. Switch on the rest when you need it.</h2>
          <p className="landing-lead">
            Analytics and funnels come with every account. Replays, heatmaps and automations are
            optional: add only what your team will use.
          </p>
        </div>

        <div role="tablist" aria-label="Seentics capabilities" className="mb-8 flex flex-wrap justify-center gap-2">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={i === active}
              aria-controls="explorer-panel"
              onClick={() => {
                setActive(i);
                setTouched(true);
              }}
              className={cn(
                'relative flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                i === active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {i === active && !touched && visible && !reduceMotion && (
                <motion.span
                  key={`bar-${active}`}
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary-foreground/60"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: ADVANCE_MS / 1000, ease: 'linear' }}
                />
              )}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id="explorer-panel"
          aria-labelledby={`tab-${tab.id}`}
          className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:gap-12"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <span
                className={cn(
                  'mb-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                  tab.core ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                )}
              >
                {tab.core ? 'Included on every plan' : 'Optional add-on'}
              </span>
              <h3 className="landing-h3 mb-3 text-balance">{tab.title}</h3>
              <p className="landing-body mb-5 text-muted-foreground">{tab.description}</p>
              <ul className="mb-6 space-y-2.5">
                {tab.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link href={tab.href} className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/75">
                Read the docs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </AnimatePresence>

          <div className="min-w-0" aria-hidden>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <MacbookFrame designWidth={1100} designHeight={688} url={tab.url}>
                  <tab.Mock />
                </MacbookFrame>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
