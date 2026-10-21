'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/stores/useAuthStore';
import { HeroExplorer } from './HeroExplorer';
import { useT } from '@/lib/i18n';

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
  const t = useT();

  // Always animated, never conditionally: the server renders the first frame, and a
  // client that then dropped the animation for reduced motion left the hero invisible.
  // Reduced motion gets the same end state with no duration.
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: reduce ? { duration: 0 } : { duration: 0.8, delay, ease: EASE },
  });

  return (
    <section className="relative overflow-hidden pt-40 sm:pt-52 lg:pt-64">
      <div className="lx-container relative">

        <motion.h1
          {...rise(0)}
          className="lx-display text-[2.05rem] !font-bold sm:text-[3.4rem] lg:text-[4.5rem] xl:text-[4.85rem]"
        >
          {/* Two lines from sm up, the last sentence on the second; on a phone one sentence a line. */}
          {t.hero.title.split(/(?<=\.) /).map((part, i, parts) => (
            <span key={i} className={i === parts.length - 1 ? 'block' : 'block sm:inline'}>
              {i > 0 && i < parts.length - 1 && <span className="hidden sm:inline"> </span>}{part}
            </span>
          ))}
        </motion.h1>

        <motion.div {...rise(0.08)} className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="lx-dim max-w-[46rem] text-base leading-relaxed sm:text-lg">
            {t.hero.body}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={isAuthenticated ? '/websites' : '/signup'} className="lx-btn lx-btn-primary">
              {isAuthenticated ? t.common.openDashboard : t.common.startFree}
            </Link>
            <Link href="/websites/demo" className="lx-btn lx-btn-ghost">
              {t.common.exploreDemo} <ArrowRight className="h-4 w-4" />
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
            {t.hero.caption}{' '}
            <Link href="/websites/demo" className="underline decoration-[color:var(--lx-line-strong)] underline-offset-4 hover:text-[color:var(--lx-text)]">
              {t.hero.captionLink}
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
