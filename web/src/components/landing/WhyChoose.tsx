'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, MousePointerClick, ShoppingCart, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Why Seentics, one reason per row: a large statement on one side, an open graphic of the
 * claim on the other. The graphics sit directly on the page (no frames, no cards) and each
 * one is the claim itself: circles you switch on and off, what is and is not collected, the
 * real self-host commands, the real install tag with a live count, an automation running.
 */
/* 2 — Private by default: what is counted, what is never kept */
const COUNT = ['Pages viewed', 'Traffic source', 'Country', 'Device'];
const NEVER = ['Cookies', 'Fingerprints', 'IP addresses', 'Form inputs'];

function PrivacyVisual() {
  return (
    <div className="mx-auto grid w-full max-w-[480px] grid-cols-2 gap-6">
      <div>
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-500">Counted</p>
        <ul className="space-y-5">
          {COUNT.map((item) => (
            <li key={item} className="flex items-center gap-3 whitespace-nowrap text-lg font-bold leading-tight text-foreground">
              <Check className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={3} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-rose-500">Never kept</p>
        <ul className="space-y-5">
          {NEVER.map((item) => (
            <li key={item} className="flex items-center gap-3 whitespace-nowrap text-lg font-bold leading-tight text-muted-foreground">
              <X className="h-5 w-5 shrink-0 text-rose-500" strokeWidth={3} />
              <span className="line-through decoration-rose-500/70 decoration-2">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* 3 — Run it yourself: the real commands, typed out */
const TERMINAL = [
  { text: 'git clone github.com/Seentics/seentics', cmd: true },
  { text: 'docker compose up -d', cmd: true },
  { text: '✓ analytics running', cmd: false },
] as const;

function TerminalVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) return setN(TERMINAL.length);
    const timer = setInterval(() => setN((i) => (i < TERMINAL.length ? i + 1 : i)), 800);
    return () => clearInterval(timer);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[460px] py-6 font-mono">
      <div className="pointer-events-none absolute -inset-x-6 inset-y-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.18),transparent_70%)]" />
      <p className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">AGPL-3.0 · free to self-host</p>
      <div className="space-y-4 text-[17px] leading-7">
        {TERMINAL.slice(0, n).map((line) => (
          <div key={line.text} className={line.cmd ? 'text-foreground' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>
            {line.cmd && <span className="mr-3 text-muted-foreground">$</span>}
            {line.text}
          </div>
        ))}
        <span className="inline-block h-6 w-2.5 translate-y-1 animate-pulse bg-foreground/70" />
      </div>
    </div>
  );
}

/* 4 — Live in minutes: the tag, then data arriving */
const SNIPPET = `<script
  defer
  data-website-id="YOUR_WEBSITE_ID"
  src="https://app.seentics.com/trackers/seentics.min.js"
></script>`;

function InstallVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const [visitors, setVisitors] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const steps = [3, 6, 5, 9, 8, 12, 11, 15];
    let i = 0;
    const kick = setTimeout(() => setVisitors(steps[0]), 700);
    const timer = setInterval(() => {
      i = (i + 1) % steps.length;
      setVisitors(steps[i]);
    }, 1400);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
  }, [inView]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the tag stays selectable */
    }
  };

  return (
    <div ref={ref} className="mx-auto w-full max-w-[460px]">
      <div className="relative">
        <pre className="overflow-x-auto font-mono text-[13px] leading-7 text-foreground">
          <span className="text-sky-600 dark:text-sky-400">{'<script'}</span>
          {'\n  '}
          <span className="text-amber-600 dark:text-amber-400">defer</span>
          {'\n  '}
          <span className="text-amber-600 dark:text-amber-400">data-website-id</span>=<span className="text-emerald-600 dark:text-emerald-400">&quot;YOUR_WEBSITE_ID&quot;</span>
          {'\n  '}
          <span className="text-amber-600 dark:text-amber-400">src</span>=<span className="text-emerald-600 dark:text-emerald-400">&quot;https://app.seentics.com/trackers/seentics.min.js&quot;</span>
          {'\n'}
          <span className="text-sky-600 dark:text-sky-400">{'></script>'}</span>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-8 flex items-end gap-4 border-t border-border pt-6">
        <span className="text-7xl font-extrabold leading-none tracking-tight text-foreground tabular-nums">{visitors}</span>
        <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-500">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          visitors online
        </span>
      </div>
    </div>
  );
}

const REASONS = [
  {
    tag: 'Setup',
    lines: ['Live in', 'minutes.'],
    body: 'One script tag in your head. No package to install and no build step, and data starts arriving straight away.',
    href: '/docs/quick-start',
    cta: 'Read the quick start',
    visual: <InstallVisual />,
  },
  {
    tag: 'Privacy',
    lines: ['Private', 'by default.'],
    body: 'No cookies, no fingerprinting, and IP addresses are never stored. You decide what is collected, and you can export or erase it any time.',
    href: '/privacy',
    cta: 'How we handle data',
    visual: <PrivacyVisual />,
  },
  {
    tag: 'Open source',
    lines: ['Run it', 'yourself.'],
    body: 'The analytics core is open source under AGPL-3.0. Self-host it free, with no artificial limits, or let us run it for you.',
    href: 'https://github.com/Seentics/seentics',
    cta: 'View on GitHub',
    visual: <TerminalVisual />,
  },
] as const;

export default function WhyChoose() {
  return (
    <section id="why" className="pb-16 pt-20 md:pb-24 md:pt-28">
      <div className="landing-container">
        <div className="mx-auto mb-4 max-w-3xl text-center">
          <p className="landing-eyebrow">Why Seentics</p>
          <h2 className="text-balance text-2xl font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Start small. Stay in control.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Live in minutes, private by default, and open source if you want to run it yourself.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          {REASONS.map((reason, i) => {
            const external = reason.href.startsWith('http');
            return (
              <motion.div
                key={reason.tag}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="grid items-center gap-10 border-b border-border py-10 last:border-b-0 md:py-14 lg:grid-cols-2 lg:gap-16"
              >
                <div className={cn(i % 2 === 1 && 'lg:order-2')}>
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-primary">{reason.tag}</p>
                  <h3 className="text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                    {reason.lines[0]}
                    <span className="block text-muted-foreground/70">{reason.lines[1]}</span>
                  </h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{reason.body}</p>
                  <Link
                    href={reason.href}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/75"
                  >
                    {reason.cta}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="min-w-0">{reason.visual}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
