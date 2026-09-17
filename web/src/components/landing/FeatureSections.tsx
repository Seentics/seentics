'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleDollarSign,
  Filter,
  MousePointer2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MacbookFrame } from './mocks/MacbookFrame';
import { LazyAutomationBuilderMock } from './mocks/lazy';

const FEATURES = [
  {
    id: 'analytics',
    title: 'Web analytics',
    description:
      'Know where visitors come from, what they do and which journeys turn into customers.',
    tags: ['Realtime', 'Paths', 'Attribution'],
    href: '/docs/analytics',
    icon: BarChart3,
    layout: 'lg:col-span-7',
    tone: 'bg-sky-500/10 text-sky-500',
  },
  {
    id: 'funnels',
    title: 'Funnels',
    description:
      'Find the exact step that loses people and open the sessions behind the drop-off.',
    tags: ['Page + event steps', 'Segments'],
    href: '/docs/funnels',
    icon: Filter,
    layout: 'lg:col-span-5',
    tone: 'bg-violet-500/10 text-violet-500',
  },
  {
    id: 'replays',
    title: 'Session recordings',
    description:
      'Watch real journeys with console, network and JavaScript errors on the same timeline.',
    tags: ['Rage clicks', 'Masked inputs'],
    href: '/docs/session-replays',
    icon: PlayCircle,
    layout: 'lg:col-span-4',
    tone: 'bg-rose-500/10 text-rose-500',
  },
  {
    id: 'heatmaps',
    title: 'Heatmaps',
    description:
      'See what gets clicked, what is ignored and where attention stops on every device.',
    tags: ['Click maps', 'Scroll depth'],
    href: '/docs/heatmaps',
    icon: MousePointer2,
    layout: 'lg:col-span-4',
    tone: 'bg-amber-500/10 text-amber-500',
  },
  {
    id: 'revenue',
    title: 'Revenue insights',
    description:
      'Connect campaigns and customer behavior directly to purchases and lifetime value.',
    tags: ['Attribution', 'Transactions'],
    href: '/docs/analytics',
    icon: CircleDollarSign,
    layout: 'lg:col-span-4',
    tone: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    id: 'privacy',
    title: 'Privacy and control',
    description:
      'Run cookie-free analytics in our cloud or keep the complete stack and its data on your own infrastructure.',
    tags: ['GDPR-ready', 'Open source', 'Self-hostable'],
    href: '/docs',
    icon: ShieldCheck,
    layout: 'md:col-span-2 lg:col-span-12',
    tone: 'bg-primary/10 text-primary',
  },
] as const;

function FeatureGrid() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <div className="flex items-center justify-center gap-6 pb-10 md:pb-14 lg:pb-16">
          <div>
            <p className="landing-eyebrow text-center">Capabilities</p>
            <h2 className="landing-h2 max-w-3xl">
              Seentics core capabilities
            </h2>
          </div>
        </div>

        <div className="grid divide-x-1 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Link
              id={feature.id}
              key={feature.id}
              href={feature.href}
              className={cn(
                'landing-card group relative flex flex-col overflow-hidden p-6 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-black/[0.04] sm:p-7',
              )}
            >
              <div className={cn(
                'mb-7 flex h-11 w-11 shrink-0 items-center justify-center',
                feature.tone,
              )}>
                <feature.icon className="h-5 w-5" />
              </div>
              <div className={cn('flex min-w-0 flex-1 flex-col',)}>
                <div className="min-w-0 flex-1">
                  <h3 className="landing-h3 mb-3">{feature.title}</h3>
                  <p className="landing-body max-w-2xl text-muted-foreground">{feature.description}</p>
                </div>
                <div className={cn('mt-auto flex flex-wrap gap-2 pt-7', feature.id === 'privacy' && 'sm:mt-0 sm:w-auto sm:justify-end sm:pt-0')}>
                  {feature.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function AutomationShowcase() {
  return (
    <section id="automations" className="landing-section landing-band">
      <div className="landing-container">
        <div className=" flex flex-col items-center justify-center gap-10  xl:gap-16">
          <div className="max-w-xl flex items-center justify-center flex-col text-center">
            {/* <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div> */}
            <p className="landing-eyebrow">Automations</p>
            <h2 className="landing-h2 mb-5 text-center">
              See a behavior. <span className="">Act while it matters.</span>
            </h2>
            <p className="landing-lead mb-7">
              Turn visitor signals into timely actions. Build the flow visually, review every branch, and publish without shipping new code.
            </p>
            {/* <ul className="space-y-3">
              {[
                'Trigger from exit intent, scroll depth, rage clicks or custom events',
                'Branch with conditions, delays, rate limits and A/B variants',
                'Show messages, redirect visitors or call any webhook',
              ].map((point) => (
                <li key={point} className="landing-body flex items-start gap-3 text-foreground/90">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul> */}

          </div>

          <div className="min-w-0 w-full max-w-screen-lg">
            <MacbookFrame
              designWidth={1100}
              designHeight={688}
              url="app.seentics.com/websites/acme-store/automations/exit-offer"
            >
              <LazyAutomationBuilderMock />
            </MacbookFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

function AiShowcase() {
  return (
    <section id="ai" className="landing-section">
      <div className="landing-container">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="max-w-xl">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="landing-eyebrow">AI Mode</p>
            <h2 className="landing-h2 mb-5">
              Ask a question. <span className="landing-accent">Get the evidence with the answer.</span>
            </h2>
            <p className="landing-lead mb-7">
              Ask about traffic, funnels, recordings, errors or revenue in plain language. Seentics returns the relevant metrics and can draft an automation for you to approve.
            </p>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-3 py-1.5">Bring your own model</span>
              <span className="rounded-full border border-border bg-card px-3 py-1.5">Approval before changes</span>
              <span className="rounded-full border border-border bg-card px-3 py-1.5">Answers with live data</span>
            </div>
            <Link
              href="/docs"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/75"
            >
              How AI Mode works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="landing-card overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-muted/35 px-5 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Seentics AI</p>
                <p className="text-xs text-muted-foreground">Connected to your analytics</p>
              </div>
            </div>
            <div className="space-y-4 p-5 sm:p-7">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                Why did checkout conversion fall this week?
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-muted/35 p-4">
                <p className="text-sm leading-relaxed text-foreground/90">
                  Mobile visitors are abandoning the shipping step more often. The largest change is from paid social traffic.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Checkout conversion</p>
                    <p className="mt-1 text-xl font-bold tracking-tight text-foreground">3.8%</p>
                    <p className="mt-0.5 text-xs font-medium text-rose-500">Down 18.4%</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">Mobile drop-off</p>
                    <p className="mt-1 text-xl font-bold tracking-tight text-foreground">41.2%</p>
                    <p className="mt-0.5 text-xs font-medium text-amber-500">Shipping step</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Drafted an automation</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Offer shipping help after 45 seconds of inactivity. Nothing will publish until you approve it.
                    </p>
                    <span className="mt-3 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      Review draft
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FeatureSections() {
  return (
    <>
      <FeatureGrid />
      <AutomationShowcase />
      {/* <AiShowcase /> */}
    </>
  );
}
