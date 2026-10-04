'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HeroCTA } from './HeroCTA';
import { DashboardMock } from './mocks/DashboardMock';

/** The part of the headline that changes: each product, in its own colour. */
const ROTATING = [
  { label: 'Analytics & replay', color: 'text-primary' },
  { label: 'Backend observability', color: 'text-[hsl(267_60%_47%)] dark:text-[hsl(267_75%_70%)]' },
  { label: 'Uptime monitoring', color: 'text-[hsl(145_72%_38%)] dark:text-[hsl(145_65%_55%)]' },
  { label: 'Smart automations', color: 'text-amber-500' },
];
const ROTATE_MS = 2800;


/** Design size of the dashboard shot, before it is scaled into the column. */
const SHOT_W = 1440;
const SHOT_H = 840;

function RotatingPhrase() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % ROTATING.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    // Fixed height, so the headline never changes size as the phrase changes.
    <span className="relative block h-[1.3em] overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={index}
          className={`absolute left-0 top-0 whitespace-nowrap ${ROTATING[index].color}`}
          initial={{ y: '70%', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-70%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          {ROTATING[index].label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * The dashboard, as a picture: not clickable, not focusable, not announced.
 *
 * It is scaled from its design size to the column and cropped at the right and
 * bottom, so the sidebar and the first charts read at a size you can actually see
 * instead of the whole page shrunk to a thumbnail. From `lg` it is tilted and
 * fades out at the bottom.
 */
function HeroShot() {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setScale((el.clientWidth / SHOT_W) * (window.innerWidth >= 1024 ? 1.28 : 1.1));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative lg:-mr-[9vw]">
      <div className="pointer-events-none absolute -inset-x-10 -inset-y-14 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.14),transparent_68%)] blur-2xl" />
      <div
        ref={frame}
        className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_40px_100px_-30px_rgba(0,0,0,0.45)] lg:[transform-origin:left_center] lg:[transform:perspective(2800px)_rotateY(-9deg)_rotateX(2deg)_scale(0.97)]"
        style={{
          height: SHOT_H * scale,
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 55%, rgba(0,0,0,0.55) 80%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 0%, black 55%, rgba(0,0,0,0.55) 80%, transparent 100%)',
        }}
      >
        <div
          aria-hidden
          inert
          className="pointer-events-none select-none"
          style={{ width: SHOT_W, height: SHOT_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <DashboardMock flush />
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />

      <div className="landing-container relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-8">
          <div className="max-w-[660px]">
            <h1 className="text-[2.1rem] font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[3.6rem]">
              <span className="block">One platform for</span>
              <RotatingPhrase />
            </h1>

            <p className="landing-lead mt-6 max-w-xl text-balance">
              Web analytics, session replay, observability and uptime monitoring in one{' '}
              <span className="whitespace-nowrap">privacy-first</span> platform.
            </p>

            <div className="mt-8">
              <HeroCTA align="left" />
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Need just one? Take only that product and pay only for it. Or get all three with the Suite.
            </p>
          </div>

          <HeroShot />
        </div>
      </div>
    </section>
  );
}
