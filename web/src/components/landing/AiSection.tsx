import Link from 'next/link';
import { ArrowRight, CheckCircle2, Flame, LayoutDashboard, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { MacbookFrame } from './mocks/MacbookFrame';
import { LazyAiModeMock } from './mocks/lazy';

/**
 * Seentics AI on the landing page, shown as the product: the assistant itself (the same
 * conversation components the app renders) beside three small screens in the app's own styling —
 * the dashboard's one-line brief and the "What happened" lines on recordings and heatmaps.
 */

const RECORDINGS = [
  { dot: 'bg-red-500', who: 'United Kingdom', text: 'Coupon failed, so they left without paying.' },
  { dot: 'bg-orange-500', who: 'Canada', text: 'Clicked the Pro plan card 5 times. Nothing.' },
  { dot: 'bg-emerald-500', who: 'France', text: 'Read the docs and started a trial.' },
] as const;

const HEATMAPS = [
  { dot: 'bg-orange-500', page: '/pricing', text: '32% of clicks hit things that do nothing' },
  { dot: 'bg-orange-500', page: '/blog', text: 'Only 38% scroll past halfway' },
  { dot: 'bg-emerald-500', page: '/signup', text: 'Healthy — 92% scroll past halfway' },
] as const;

function Screen({ icon: Icon, label, children }: { icon: typeof Sparkles; label: string; children: React.ReactNode }) {
  return (
    <div className="landing-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function AiSection() {
  return (
    <section id="ai" className="landing-section">
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="landing-eyebrow">Seentics AI</p>
          <h2 className="landing-h2 mb-4">
            Know what happened. <span className="landing-accent">Without digging.</span>
          </h2>
          <p className="landing-lead">Every page explains itself in plain words, and AI drafts the fix.</p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-10">
          <div className="min-w-0">
            <MacbookFrame designWidth={1100} designHeight={688} url="app.seentics.com/websites/acme-store/ai">
              <LazyAiModeMock />
            </MacbookFrame>
          </div>

          <div className="flex min-w-0 flex-col gap-4" aria-hidden="true">
            <Screen icon={LayoutDashboard} label="Dashboard">
              <div className="flex items-center gap-2 px-4 py-3 text-sm">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-foreground">Checkout errors surged</span>
                  <span className="px-1.5 text-muted-foreground/50">·</span>
                  <span className="text-foreground/80">Visitors up 8% this week</span>

                </p>
              </div>
            </Screen>

            <Screen icon={PlayCircle} label="Session recordings — What happened">
              <ul className="divide-y divide-border">
                {RECORDINGS.map((r) => (
                  <li key={r.text} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                    <span className="w-20 shrink-0 truncate text-xs text-muted-foreground sm:w-24">{r.who}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
                    <span className="min-w-0 flex-1 truncate text-foreground/90">{r.text}</span>
                  </li>
                ))}
              </ul>
            </Screen>

            <Screen icon={Flame} label="Heatmaps — What happened">
              <ul className="divide-y divide-border">
                {HEATMAPS.map((h) => (
                  <li key={h.page} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                    <span className="w-16 shrink-0 truncate font-mono text-xs text-muted-foreground sm:w-24">{h.page}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${h.dot}`} />
                    <span className="min-w-0 flex-1 truncate text-foreground/90">{h.text}</span>
                  </li>
                ))}
              </ul>
            </Screen>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-5">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Every number comes from your data</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" />Nothing changes until you confirm</li>
          </ul>
          <Link
            href="/websites/demo"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try it in the live demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
