'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveDemoFrame } from './LiveDemoFrame';

/**
 * How it works, told by scrolling.
 *
 * The section pins (like the product previews) and one large picture builds across three
 * screens of scroll: a site is added, the script tag is written into a page, and the real
 * dashboard fills with data. The three steps are a true sequence, so numbering them is
 * information, not decoration.
 */
const STEPS = [
  { title: 'Connect', body: 'Add your website, a service or an endpoint. One field, one click.' },
  { title: 'Send', body: 'Paste one script tag in your <head>. Services send OpenTelemetry; uptime needs nothing installed.' },
  { title: 'See', body: 'Visitors, funnels, traces and alerts fill in as data arrives.' },
] as const;

const THRESHOLDS = [0, 0.34, 0.68] as const;
const SITE = 'acme-store.com';
const SITE_ID = '3f9c1b7e-52a4-4c8e-9d10-6b7a2e41f0c3';

function useTyped(text: string, active: boolean, speed = 60) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    setN(0);
    const timer = setInterval(() => setN((i) => (i < text.length ? i + 1 : i)), speed);
    return () => clearInterval(timer);
  }, [text, active, speed]);
  return text.slice(0, n);
}

function Window({ title, children, dark }: { title: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]', dark ? 'border-white/10 bg-zinc-900' : 'border-border bg-card')}>
      <div className={cn('flex h-[38px] items-center gap-3 border-b px-3', dark ? 'border-white/10 bg-zinc-950/60' : 'border-border bg-muted/60')}>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className={cn('mx-auto text-[11px]', dark ? 'text-white/50' : 'text-muted-foreground')}>{title}</span>
        <span className="w-10" />
      </div>
      {children}
    </div>
  );
}

function ConnectVisual() {
  const typed = useTyped(SITE, true, 70);
  const done = typed.length === SITE.length;
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setAdded(true), 900);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <Window title="app.seentics.com / websites / new">
      <div className="space-y-5 p-8">
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">Add a website</p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 flex-1 items-center gap-2.5 rounded-lg border border-border bg-background px-4">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-[15px] text-foreground">
                {typed}
                {!added && <span className="ml-px inline-block h-5 w-[2px] translate-y-1 animate-pulse bg-primary" />}
              </span>
            </div>
            <span
              className={cn(
                'flex h-12 items-center rounded-lg px-5 text-sm font-semibold transition-all duration-300',
                done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                added && 'scale-95',
              )}
            >
              {added ? 'Added' : 'Add website'}
            </span>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: added ? 1 : 0, y: added ? 0 : 10 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {SITE} is ready
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Website ID</p>
          <p className="font-mono text-[13px] text-foreground">{SITE_ID}</p>
        </motion.div>

        <p className="text-xs text-muted-foreground">Adding a service or an endpoint works the same way.</p>
      </div>
    </Window>
  );
}

const CODE: { text: string; fresh?: boolean }[] = [
  { text: '<!DOCTYPE html>' },
  { text: '<html>' },
  { text: '  <head>' },
  { text: '    <title>Acme Store</title>' },
  { text: '    <script', fresh: true },
  { text: '      defer', fresh: true },
  { text: `      data-website-id="${SITE_ID.slice(0, 8)}…"`, fresh: true },
  { text: '      src="https://app.seentics.com/trackers/seentics.min.js"', fresh: true },
  { text: '    ></script>', fresh: true },
  { text: '  </head>' },
];

function tint(line: string) {
  // A light touch of syntax colour: tags, attribute names, strings.
  const parts = line.split(/("[^"]*"?)/g);
  return parts.map((part, i) =>
    part.startsWith('"') ? (
      <span key={i} className="text-emerald-400">{part}</span>
    ) : (
      <span key={i} className="text-zinc-300">
        {part.split(/(<\/?[a-zA-Z!]+|>|data-website-id|defer|src)/g).map((seg, j) =>
          /^(<\/?[a-zA-Z!]+|>)$/.test(seg) ? (
            <span key={j} className="text-sky-400">{seg}</span>
          ) : /^(data-website-id|defer|src)$/.test(seg) ? (
            <span key={j} className="text-amber-300">{seg}</span>
          ) : (
            seg
          ),
        )}
      </span>
    ),
  );
}

function SendVisual() {
  const [shown, setShown] = useState(4); // the first four lines are already there
  useEffect(() => {
    setShown(4);
    const timer = setInterval(() => setShown((n) => (n < CODE.length ? n + 1 : n)), 420);
    return () => clearInterval(timer);
  }, []);
  const done = shown >= CODE.length;

  return (
    <Window title="index.html" dark>
      <div className="p-5 font-mono text-[13px] leading-7">
        {CODE.slice(0, shown).map((line, i) => (
          <motion.div
            key={i}
            initial={line.fresh ? { opacity: 0, x: -8 } : false}
            animate={{ opacity: 1, x: 0 }}
            className={cn('flex gap-4 rounded px-2', line.fresh && 'bg-emerald-500/10')}
          >
            <span className="w-5 select-none text-right text-zinc-600">{i + 1}</span>
            <span className="whitespace-pre">{tint(line.text)}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-white/10 bg-zinc-950/60 px-5 py-3 text-xs">
        <span className="text-zinc-500">Observability: set OTEL_EXPORTER_OTLP_ENDPOINT · Uptime: nothing to install</span>
        <motion.span
          initial={false}
          animate={{ opacity: done ? 1 : 0 }}
          className="inline-flex items-center gap-1.5 font-semibold text-emerald-400"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Receiving data
        </motion.span>
      </div>
    </Window>
  );
}

export default function SetupStory() {
  const reduce = useReducedMotion();
  const outer = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [visualHeight, setVisualHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      setPinned(query.matches);
      setVisualHeight(query.matches ? Math.max(420, window.innerHeight - 88 - 40) : undefined);
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
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    if (!pinned) return;
    setStep(p >= THRESHOLDS[2] ? 2 : p >= THRESHOLDS[1] ? 1 : 0);
  });

  const choose = (i: number) => {
    const el = outer.current;
    if (!pinned || !el) return setStep(i);
    const range = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + range * (THRESHOLDS[i] + 0.08), behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section id="how-it-works" className="pt-16 md:pt-24">
      <div ref={outer} className="relative" style={pinned ? { height: '300vh' } : undefined}>
        <div
          className="landing-container"
          style={pinned ? { position: 'sticky', top: 88, height: 'calc(100vh - 88px)', display: 'flex', alignItems: 'center' } : undefined}
        >
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-14">
            <div>
              <p className="landing-eyebrow">How it works</p>
              <h2 className="mb-8 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Connect. Send. See.
              </h2>

              <ol className="relative space-y-1">
                <span className="absolute left-[15px] top-4 bottom-4 w-px bg-border" aria-hidden />
                {STEPS.map((s, i) => {
                  const on = i === step;
                  return (
                    <li key={s.title}>
                      <button onClick={() => choose(i)} className="relative flex w-full items-start gap-4 rounded-xl py-3 text-left">
                        <span
                          className={cn(
                            'relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors duration-300',
                            on ? 'border-primary bg-primary text-primary-foreground' : i < step ? 'border-primary/50 bg-background text-primary' : 'border-border bg-background text-muted-foreground',
                          )}
                        >
                          {i < step ? <Check className="h-4 w-4" /> : i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className={cn('block text-lg font-bold transition-colors', on ? 'text-foreground' : 'text-muted-foreground')}>{s.title}</span>
                          <AnimatePresence initial={false}>
                            {on && (
                              <motion.span
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="block overflow-hidden text-sm leading-relaxed text-muted-foreground"
                              >
                                <span className="block pt-1">{s.body}</span>
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="relative min-w-0" style={visualHeight ? { minHeight: Math.min(visualHeight, 560) } : undefined}>
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-primary/10 blur-3xl" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.35 }}
                >
                  {step === 0 && <ConnectVisual />}
                  {step === 1 && <SendVisual />}
                  {step === 2 && (
                    <LiveDemoFrame
                      src="/websites/demo"
                      label="seentics.com/websites/demo"
                      title="Live analytics dashboard"
                      height={visualHeight ? Math.min(visualHeight, 520) : undefined}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
