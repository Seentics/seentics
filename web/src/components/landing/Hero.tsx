'use client';

import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/stores/useAuthStore';
import { HeroExplorer } from './HeroExplorer';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The page's thesis: one sentence about what the product is for, and the product itself.
 *
 * The dashboard rises out of a slight tilt on load — the one orchestrated moment on the
 * page. With reduced motion everything is simply there.
 */
export default function Hero() {
  const reduce = useReducedMotion();
  const { isAuthenticated } = useAuth();

  // Always animated, never conditionally: the server renders the first frame, and a
  // client that then dropped the animation for reduced motion left the hero invisible.
  // Reduced motion gets the same end state with no duration.
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: reduce ? { duration: 0 } : { duration: 0.8, delay, ease: EASE },
  });

  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36">
      {/* Light falling on the shot from above. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[38%] -z-0 mx-auto h-[640px] max-w-[1100px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--lx-glow), transparent)' }}
      />

      <div className="lx-container relative">
        <motion.div {...rise(0)}>
          <Link href="/websites/demo/ai" className="lx-pill">
            <span className="font-medium" style={{ color: 'var(--lx-text)' }}>Seentics AI</span>
            <span aria-hidden className="h-3 w-px" style={{ background: 'var(--lx-line-strong)' }} />
            Ask your analytics in plain words
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>

        <motion.h1
          {...rise(0.08)}
          className="lx-display mt-6 max-w-[15ch] text-[2.75rem] !font-bold sm:text-6xl lg:text-[4.75rem]"
        >
          Analytics that shows you why visitors leave
        </motion.h1>

        <motion.div {...rise(0.16)} className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="lx-dim max-w-[34rem] text-lg leading-relaxed sm:text-xl">
            Product analytics, session replay, heatmaps and automations in one open-source, privacy-first
            platform. One script tag, live in two minutes.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={isAuthenticated ? '/websites' : '/signup'} className="lx-btn lx-btn-primary">
              {isAuthenticated ? 'Open dashboard' : 'Start for free'}
            </Link>
            <Link href="/websites/demo" className="lx-btn lx-btn-ghost">
              Explore the demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>

        <div className="mt-16 sm:mt-20 [perspective:2400px]">
          <motion.div
            initial={{ opacity: 0, rotateX: 18, y: 70 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 1.3, delay: 0.3, ease: EASE }}
            style={{ transformOrigin: 'center top' }}
          >
            <HeroExplorer />
          </motion.div>
          <p className="lx-faint mt-6 text-center text-sm">
            The real dashboard, with demo data. Use the sidebar to look around, or{' '}
            <Link href="/websites/demo" className="underline decoration-[color:var(--lx-line-strong)] underline-offset-4 hover:text-[color:var(--lx-text)]">
              open the full demo
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
