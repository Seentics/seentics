'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
    <section className="relative overflow-hidden pt-36 sm:pt-48 lg:pt-56">
      <div className="lx-container relative">

        <motion.h1
          {...rise(0.08)}
          className="lx-display max-w-[16ch] text-[2.25rem] !font-bold sm:text-5xl lg:text-[3.5rem]"
        >
          Analytics that shows you why visitors leave
        </motion.h1>

        <motion.div {...rise(0.16)} className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="lx-dim max-w-[34rem] text-base leading-relaxed sm:text-lg">
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
