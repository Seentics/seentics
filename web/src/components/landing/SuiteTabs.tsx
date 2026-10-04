'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ArrowRight, Bell, BarChart3, Check, Bug, Filter, Globe, Layers, MousePointer2, PlayCircle, Radio, Zap, HeartPulse, ActivitySquare } from 'lucide-react';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';
import { LiveDemoFrame } from './LiveDemoFrame';
import { ObserveGlyph } from './LandingHeader';

const PRODUCTS = [
  {
    id: 'analytics',
    name: 'Analytics',
    color: 'hsl(var(--primary))',
    icon: BarChart3,
    pitch: 'See who visits, where they drop off and what to fix.',
    points: [
      { icon: Filter, text: 'Funnels with the sessions behind every drop-off' },
      { icon: PlayCircle, text: 'Session replay and heatmaps' },
      { icon: Zap, text: 'Automations on exit intent and rage clicks' },
    ],
    cta: 'Start with Analytics',
    // The analytics demo follows this page's theme; the Observability and Uptime apps are dark in both.
    darkFrame: false,
    href: '/signup',
    external: false,
    solo: 'Take Analytics on its own',
    demo: { src: '/websites/demo', label: 'seentics.com/websites/demo' },
  },
  {
    id: 'observability',
    name: 'Observability',
    color: 'hsl(267 60% 52%)',
    icon: ObserveGlyph,
    pitch: 'Know what is happening inside every service behind your site.',
    points: [
      { icon: Layers, text: 'Logs, metrics and distributed traces' },
      { icon: Radio, text: 'OpenTelemetry ingestion' },
      { icon: Bug, text: 'Errors grouped across services' },
    ],
    cta: 'Explore Observability',
    darkFrame: true,
    href: config.observeUrl,
    external: true,
    solo: 'Take Observability on its own',
    demo: { src: `${config.observeUrl}/projects/demo`, label: 'observe.seentics.com/projects/demo' },
  },
  {
    id: 'uptime',
    name: 'Uptime',
    color: 'hsl(145 72% 38%)',
    icon: ActivitySquare,
    pitch: 'Find out the moment your site goes down, before customers do.',
    points: [
      { icon: HeartPulse, text: 'Checks every 60 seconds' },
      { icon: Bell, text: 'Alerts to Slack, email or SMS' },
      { icon: Globe, text: 'A public status page' },
    ],
    cta: 'Explore Uptime',
    darkFrame: true,
    href: config.uptimeUrl,
    external: true,
    solo: 'Take Uptime on its own',
    demo: { src: `${config.uptimeUrl}/demo`, label: 'uptime.seentics.com/demo' },
  },
] as const;

type ProductId = (typeof PRODUCTS)[number]['id'];

/** Where in the scroll range each product takes over (0 = section pinned, 1 = released). */
const STEPS = [0, 0.34, 0.68] as const;

/** One headline and description per product, swapped as the stack advances. */
const COPY = [
  {
    title: 'Understand every visitor.',
    body: 'Funnels, session replay, heatmaps and automations. Available on its own.',
  },
  {
    title: 'See inside every service.',
    body: 'Logs, metrics and traces for every service behind your site. Available on its own.',
  },
  {
    title: 'Know before your customers do.',
    body: '60-second checks, instant alerts and a public status page. Available on its own.',
  },
] as const;

export default function SuiteTabs() {
  const outer = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [frameHeight, setFrameHeight] = useState<number | undefined>(undefined);
  const product = PRODUCTS[activeIndex];
  const copy = COPY[activeIndex];

  // From `lg` the section is pinned and scroll drives it; below that it is a plain switcher.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      setPinned(query.matches);
      // What is left of the screen under the header, the title block and the gaps.
      setFrameHeight(query.matches ? Math.max(420, window.innerHeight - 88 - 102 - 20) : undefined);
    };
    update();
    query.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: outer, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    if (!pinned) return;
    const next = progress >= STEPS[2] ? 2 : progress >= STEPS[1] ? 1 : 0;
    setActiveIndex(next);
  });

  return (
    <section id="products" className="pb-20 pt-20 md:pb-32 md:pt-32">
      {/* Pinned on desktop: three screens of scroll, one product revealed per screen. */}
      <div ref={outer} className="relative" style={pinned ? { height: '300vh' } : undefined}>
        <div
          className="landing-container"
          style={
            pinned
              ? { position: 'sticky', top: 88, height: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }
              : undefined
          }
        >
          <div className="mx-auto w-full max-w-[1100px]">
            <div className="mb-4 text-center">
              <div className="relative h-[8.5rem] sm:h-[4.75rem]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeIndex}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-x-0 top-0"
                  >
                    <h2 className="mb-2 text-balance text-2xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                      {copy.title}
                    </h2>
                    <p className="mx-auto max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base lg:whitespace-nowrap">{copy.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-x-6 inset-y-0 -z-10 rounded-[48px] opacity-20 blur-3xl transition-colors duration-500"
                style={{ background: product.color }}
              />
              {/* One preview at a time: the next one slides in as the last one leaves. */}
              <div className="relative grid grid-cols-[minmax(0,1fr)]">
                {PRODUCTS.map((p, i) => {
                  const current = i === activeIndex;
                  return (
                    <motion.div
                      key={p.id}
                      className="[grid-area:1/1]"
                      style={{ zIndex: current ? 2 : 1, pointerEvents: current ? 'auto' : 'none' }}
                      initial={false}
                      animate={{ y: current ? 0 : i > activeIndex ? 70 : -30, opacity: current ? 1 : 0, scale: current ? 1 : 0.97 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], opacity: { duration: current ? 0.35 : 0.18, delay: current ? 0.15 : 0 } }}
                    >
                      <LiveDemoFrame src={p.demo.src} label={p.demo.label} title={`${p.name} live demo`} height={frameHeight} />
                    </motion.div>
                  );
                })}
              </div>

              {/* The action sits on the bottom of the preview, over a fade. Two fades cross-fade, so the
                  colour follows whichever preview is showing: this page's theme for Analytics, and
                  black for the Observability and Uptime apps, which are dark in both themes. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[10] h-28 rounded-b-xl">
                <div
                  className="absolute inset-0 rounded-b-xl bg-gradient-to-t from-background via-background/80 to-transparent transition-opacity duration-500"
                  style={{ opacity: product.darkFrame ? 0 : 1 }}
                />
                <div
                  className="absolute inset-0 rounded-b-xl bg-gradient-to-t from-black/80 via-black/45 to-transparent transition-opacity duration-500"
                  style={{ opacity: product.darkFrame ? 1 : 0 }}
                />
                <div className="absolute inset-x-0 bottom-0 flex justify-center pb-5">
                  <Link
                  href={product.href}
                  {...(product.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
                  style={{ background: product.color }}
                >
                  {product.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                </div>
              </div>
            </div>

            {/* Without scroll pinning (phones, tablets) the products are switched by hand. */}
            {!pinned && (
              <div role="tablist" aria-label="Seentics products" className="mx-auto mt-6 flex w-fit gap-1 rounded-full border border-border bg-card p-1">
                {PRODUCTS.map((p, i) => (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={i === activeIndex}
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      'rounded-full px-3.5 py-2 text-xs font-semibold transition-colors',
                      i === activeIndex ? 'text-white' : 'text-muted-foreground',
                    )}
                    style={i === activeIndex ? { background: p.color } : undefined}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
