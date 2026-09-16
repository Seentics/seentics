import { ArrowRight, Check, Eye, GitBranch, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';

const WORKFLOW = [
  {
    icon: Eye,
    step: '01',
    title: 'See what happened',
    description: 'Analytics, funnels and revenue show where attention and conversions changed.',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'Understand why',
    description: 'Recordings, heatmaps and AI connect the number to the behavior behind it.',
  },
  {
    icon: Zap,
    step: '03',
    title: 'Respond immediately',
    description: 'Turn the signal into a message, redirect or webhook without another deploy.',
  },
] as const;

const OWNERSHIP = [
  'Cookie-free tracking by default',
  'Self-host the complete platform',
  'Raw event data available through the API',
  'Open-source under AGPL-3.0',
] as const;

export default function WhySwitch() {
  return (
    <section className="landing-section landing-band landing-band-reverse">
      <div className="landing-container">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end lg:gap-16">
          <div>
            <p className="landing-eyebrow">Why Seentics</p>
            <h2 className="landing-h2 max-w-3xl">
              Stop moving between tools <span className="landing-accent">to understand one journey.</span>
            </h2>
            <p className="landing-lead mt-5 max-w-2xl">
              GA4, Plausible and Hotjar each cover part of the story. Seentics connects measurement, evidence and action in one workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {['Analytics', 'Recordings', 'Heatmaps', 'Funnels', 'AI', 'Automations'].map((label) => (
              <span key={label} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {WORKFLOW.map((item) => (
            <article key={item.title} className="landing-card p-6 sm:p-7">
              <div className="mb-7 flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold tabular-nums text-muted-foreground/50">{item.step}</span>
              </div>
              <h3 className="landing-h3 mb-3">{item.title}</h3>
              <p className="landing-body text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[1fr_auto]">
          <div className="p-6 sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Your data stays yours</p>
                <p className="text-sm text-muted-foreground">Cloud convenience without giving up control.</p>
              </div>
            </div>
            <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {OWNERSHIP.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/docs/privacy"
            className="group flex items-center justify-center gap-2 border-t border-border bg-muted/30 px-8 py-5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary lg:border-l lg:border-t-0"
          >
            <GitBranch className="h-4 w-4" />
            See how data is handled
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
