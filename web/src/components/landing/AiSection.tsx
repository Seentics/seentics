'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Bug,
  CheckCircle2,
  Filter,
  Flame,
  LayoutDashboard,
  MessagesSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Seentics AI on the landing page, page by page: what each part of the product now says in plain
 * words. Every line below is the kind the dashboard renders for the demo site — the one-line brief,
 * the "What happened" column — so the page cannot promise something the product does not show.
 */

type Row = { label?: string; meta?: string; dot: string; text: string; strong?: boolean };
type Tab = {
  id: string;
  name: string;
  icon: typeof Sparkles;
  headline: string;
  body: string;
  rows: Row[];
  column?: string;
};

const TABS: Tab[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    headline: 'The day in one line',
    body: 'Above your numbers: the alert that matters, what changed, and the one thing to do next.',
    rows: [],
  },
  {
    id: 'recordings',
    name: 'Session recordings',
    icon: PlayCircle,
    headline: 'What happened, in every session',
    body: 'Skip the scrubbing. Each recording says what the visitor tried, where they struggled and how it ended.',
    column: 'What happened',
    rows: [
      { label: 'United Kingdom', meta: '5m 00s', dot: 'bg-red-500', text: 'Tried to buy Pro with a coupon; the coupon failed and they left without paying.', strong: true },
      { label: 'Canada', meta: '1m 04s', dot: 'bg-orange-500', text: 'Clicked the Pro plan card on /pricing 5 times — nothing happened.', strong: true },
      { label: 'Germany', meta: '10m 04s', dot: 'bg-amber-400', text: 'Started the signup form on /signup and gave up.' },
      { label: 'France', meta: '6m 08s', dot: 'bg-emerald-500', text: 'Read the docs introduction and signed up for a trial.' },
    ],
  },
  {
    id: 'heatmaps',
    name: 'Heatmaps',
    icon: Flame,
    headline: 'Every page, diagnosed',
    body: 'Dead clicks, visitors who never scroll far enough, and pages that work on desktop but not on mobile.',
    column: 'What happened',
    rows: [
      { label: '/pricing', dot: 'bg-orange-500', text: '32% of clicks hit things that do nothing · mobile scrolls 31% vs desktop 64%', strong: true },
      { label: '/blog/why-real-time', dot: 'bg-orange-500', text: 'Only 38% scroll past halfway', strong: true },
      { label: '/signup', dot: 'bg-emerald-500', text: 'Healthy — 92% scroll past halfway, 3% dead clicks' },
    ],
  },
  {
    id: 'errors',
    name: 'Errors',
    icon: Bug,
    headline: 'Which errors actually hurt',
    body: 'New, getting worse, or hitting checkout — and how many visitors each one reached.',
    column: 'What happened',
    rows: [
      { label: 'Network request failed', dot: 'bg-red-500', text: 'Up from 74 · 317 times on /checkout this week, 96 visitors affected', strong: true },
      { label: 'Cannot read properties of undefined', dot: 'bg-red-500', text: 'New · 1,284 times on /pricing, 412 visitors affected', strong: true },
      { label: 'ResizeObserver loop', dot: 'bg-muted-foreground/40', text: 'Browser warning — usually harmless' },
    ],
  },
  {
    id: 'funnels',
    name: 'Funnels',
    icon: Filter,
    headline: 'Where people leave, and whether it is getting worse',
    body: 'Each funnel names its biggest leak and compares it with the period before.',
    column: 'What happened',
    rows: [
      { label: 'Main conversion path', dot: 'bg-red-500', text: 'Converts 5.7% · most leave at Feature Explore → Pricing View (56%) · down from 6.6%', strong: true },
      { label: 'Blog reader engagement', dot: 'bg-emerald-500', text: 'Converts 12% · most leave at Article Read → Docs View (73%) · up from 10%' },
    ],
  },
  {
    id: 'automations',
    name: 'Automations',
    icon: Zap,
    headline: 'Which automations are earning their keep',
    body: 'Failing, live but never fired, or working — and the measured effect of each change you made.',
    column: 'What happened',
    rows: [
      { label: 'Exit-intent offer', dot: 'bg-emerald-500', text: 'Ran 6,210 times · 2,840 in the last 30 days · 100% succeeded' },
      { label: 'High-value lead alert', dot: 'bg-red-500', text: 'Failing — 12 of 50 runs failed (76% succeeded)', strong: true },
      { label: 'Retention email', dot: 'bg-muted-foreground/40', text: 'Switched off · ran 843 times before' },
    ],
  },
  {
    id: 'ask',
    name: 'Ask AI',
    icon: MessagesSquare,
    headline: 'Ask in plain words. Approve the fix.',
    body: 'Answers come with your real numbers. Changes come as drafts — nothing happens until you confirm.',
    rows: [],
  },
];

const TRUST = [
  { icon: CheckCircle2, text: 'Every number comes from your data' },
  { icon: ShieldCheck, text: 'Nothing changes until you confirm it' },
  { icon: Zap, text: 'OpenAI or Claude, at a fraction of a cent' },
] as const;

export default function AiSection() {
  const [active, setActive] = useState(TABS[0]!.id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]!;

  return (
    <section id="ai" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="landing-eyebrow">Seentics AI</p>
          <h2 className="landing-h2 mb-5">
            Every page tells you what happened. <span className="landing-accent">In plain English.</span>
          </h2>
          <p className="landing-lead">
            No more reading charts to work out what went wrong. Seentics turns your traffic, recordings, heatmaps,
            errors and funnels into one clear sentence each — and drafts the fix.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div role="tablist" aria-label="Seentics AI by page" className="mb-6 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === active}
                onClick={() => setActive(t.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  t.id === active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.name}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="landing-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-5 py-4">
              <p className="text-base font-semibold text-foreground">{tab.headline}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{tab.body}</p>
            </div>
            <div className="p-4 sm:p-5">
              {tab.id === 'dashboard' ? <DashboardPreview /> : tab.id === 'ask' ? <AskPreview /> : <RowsPreview tab={tab} />}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-4xl flex-col items-center gap-6">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-emerald-500" />
                {text}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/websites/demo"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try it in the live demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/websites/demo/ai"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <MessagesSquare className="h-4 w-4" />
              Ask the demo AI
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function RowsPreview({ tab }: { tab: Tab }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="hidden sm:block sm:w-56 sm:shrink-0">{tab.name === 'Session recordings' ? 'Session' : tab.name === 'Heatmaps' ? 'Page' : tab.name === 'Errors' ? 'Error' : tab.name.replace(/s$/, '')}</span>
        <span className="flex items-center gap-1.5 text-primary">
          <Sparkles className="h-3 w-3" />
          {tab.column}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {tab.rows.map((r) => (
          <li key={r.text} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3">
            <span className="truncate font-medium text-foreground sm:w-56 sm:shrink-0">
              {r.label}
              {r.meta && <span className="ml-2 text-xs font-normal text-muted-foreground">{r.meta}</span>}
            </span>
            <span className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full sm:mt-0', r.dot)} />
              <span className={cn('min-w-0', r.strong ? 'text-foreground' : 'text-muted-foreground')}>{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashboardPreview() {
  const stats = [
    ['Visitors', '12,340', '+8%'],
    ['Pageviews', '40,100', '+5%'],
    ['Bounce rate', '42%', '0%'],
    ['Avg. session', '2m 34s', '+10%'],
  ] as const;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.05] px-3 py-2.5 text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate">
          <span className="font-medium text-foreground">Checkout errors surged</span>
          <span className="px-1.5 text-muted-foreground/50">·</span>
          <span className="text-foreground/90">Visitors rose 8% week over week</span>
          <span className="px-1.5 text-muted-foreground/50">·</span>
          <span className="text-foreground/90">Next: make the plan cards on /pricing clickable</span>
        </p>
        <span className="hidden shrink-0 text-xs font-medium text-primary sm:inline">Details →</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value, delta]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold tracking-tight text-foreground">{value}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{delta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AskPreview() {
  return (
    <div className="space-y-3">
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        Why are mobile visitors struggling on /pricing?
      </div>
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground/90">
        32% of mobile clicks on /pricing land on the plan cards, which are not links, and the Start trial button sits
        below where most mobile visitors stop scrolling.
        <span className="mt-2 block text-foreground">Next: make each plan card link to its signup. Want me to draft it?</span>
      </div>
      <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Pricing exit offer — 20% off annual</p>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">Draft — nothing created yet</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Exit intent · only on /pricing · created switched off</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Create it
          </span>
          <span className="text-xs font-medium text-muted-foreground">Not now</span>
        </div>
      </div>
    </div>
  );
}
