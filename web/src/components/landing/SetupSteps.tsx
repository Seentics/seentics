'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Globe } from 'lucide-react';

const SNIPPET = `<script
  defer
  data-website-id="YOUR_WEBSITE_ID"
  src="https://app.seentics.com/trackers/seentics.min.js"
></script>`;

function CopyButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the snippet is still selectable */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function LiveCounter() {
  const [n, setN] = useState(12);
  useEffect(() => {
    const steps = [12, 14, 13, 16, 15, 18, 17, 20];
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % steps.length;
      setN(steps[i]);
    }, 1400);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Visitors online now
      </p>
      <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-foreground">{n}</p>
      <svg viewBox="0 0 200 40" className="mt-2 h-10 w-full" aria-hidden>
        <path d="M0 30 L20 26 L40 28 L60 18 L80 22 L100 12 L120 16 L140 8 L160 14 L180 6 L200 10" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const STEPS = [
  { title: 'Add your site', body: 'Name the site you want to track.' },
  { title: 'Paste one script tag', body: 'In your <head>. No package, no build step.' },
  { title: 'Watch it come alive', body: 'Visitors, funnels and replays appear as they happen.' },
] as const;

export default function SetupSteps() {
  return (
    <section id="how-it-works" className="landing-section landing-band">
      <div className="landing-container">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">Live in minutes, not sprints.</h2>
        </div>

        <ol className="relative grid gap-5 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-5 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="landing-card relative flex flex-col p-6">
              <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-4 ring-background">
                {i + 1}
              </span>
              <h3 className="landing-h3">{step.title}</h3>
              <p className="mb-5 mt-1.5 text-sm text-muted-foreground">{step.body}</p>

              <div className="mt-auto">
                {i === 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2">
                    <Globe className="ml-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm text-muted-foreground">yourwebsite.com</span>
                    <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Add</span>
                  </div>
                )}
                {i === 1 && (
                  <div className="overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10">
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">HTML</span>
                      <CopyButton />
                    </div>
                    <pre className="overflow-x-auto p-3 text-[11.5px] leading-relaxed text-zinc-200">
                      <code>{SNIPPET}</code>
                    </pre>
                  </div>
                )}
                {i === 2 && <LiveCounter />}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
