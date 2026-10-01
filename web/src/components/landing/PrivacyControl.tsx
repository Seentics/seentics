import { Bug, Check, EyeOff, Filter, Fingerprint, Lock, MousePointer2, PlayCircle, Scale, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Privacy and control: every feature has its own switch, recordings and heatmaps follow
 * page rules, and the privacy defaults behind it. Each claim here is something the
 * product does — see the tracker's feature gating (public/trackers/seentics.js), the
 * ingest routers that skip a switched-off feature, and the privacy settings page.
 */

const SWITCHES = [
  { name: 'Session recordings', icon: PlayCircle, tone: 'text-rose-500 bg-rose-500/10', on: true },
  { name: 'Heatmaps', icon: MousePointer2, tone: 'text-amber-500 bg-amber-500/10', on: true },
  { name: 'Funnels', icon: Filter, tone: 'text-violet-500 bg-violet-500/10', on: true },
  { name: 'Automations', icon: Zap, tone: 'text-emerald-500 bg-emerald-500/10', on: false },
  { name: 'Error tracking', icon: Bug, tone: 'text-sky-500 bg-sky-500/10', on: false },
] as const;

const RULES = [
  { kind: 'Record', pattern: '/checkout/*', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { kind: 'Record', pattern: '/pricing', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { kind: 'Never', pattern: '/account/*', tone: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  { kind: 'Never', pattern: '/admin/*', tone: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' },
] as const;

const PROMISES = [
  {
    title: 'Anonymous by default',
    body: 'No cookies and no fingerprinting. Each visitor gets a random ID. IP addresses are used to look up the country, then discarded — never stored.',
    icon: Fingerprint,
  },
  {
    title: 'GDPR controls',
    body: 'Set how long data is kept, and export or erase a website\'s data from your dashboard — in our cloud or on your own servers.',
    icon: Scale,
  },
  {
    title: 'Consent and Do Not Track',
    body: 'Strict consent mode tracks nothing until your consent banner says yes. Honour Do Not Track with one switch.',
    icon: ShieldCheck,
  },
  {
    title: 'Private recordings',
    body: 'Every input is masked before it leaves the browser. Mask or block any element with one attribute, and passwords and card numbers never appear.',
    icon: EyeOff,
  },
] as const;

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-muted-foreground/25',
      )}
    >
      <span className={cn('absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </span>
  );
}

function ControlPanel() {
  return (
    <div className="landing-card overflow-hidden shadow-xl shadow-black/[0.06] ring-1 ring-primary/10">
      <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Features for acme-store.com</p>
          <p className="text-xs text-muted-foreground">Off means not loaded in the browser, not processed</p>
        </div>
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>

      <ul className="divide-y divide-border">
        {SWITCHES.map((item) => (
          <li key={item.name} className="flex items-center gap-3 px-5 py-3.5">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', item.tone)}>
              <item.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{item.name}</span>
              <span className="block text-xs text-muted-foreground">
                {item.on ? 'Collecting' : 'Off: no script, no data'}
              </span>
            </span>
            <Toggle on={item.on} />
          </li>
        ))}
      </ul>

      <div className="border-t border-border bg-muted/20 px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recording and heatmap pages</p>
        <div className="flex flex-wrap gap-2">
          {RULES.map((rule) => (
            <span key={rule.pattern} className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs', rule.tone)}>
              <span className="font-semibold">{rule.kind}</span>
              <code className="font-mono">{rule.pattern}</code>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PrivacyControl() {
  return (
    <section id="privacy-control" className="landing-section landing-band">
      <div className="landing-container">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="max-w-xl">
            <p className="landing-eyebrow">Privacy and control</p>
            <h2 className="landing-h2 mb-5">
              Collect what you need. <span className="landing-accent">Switch off the rest.</span>
            </h2>
            <p className="landing-lead mb-7">
              Every feature has its own switch. Turn one off and its code never loads in your
              visitors&apos; browsers, and nothing is collected or processed for it.
            </p>
            <ul className="space-y-3">
              {[
                'Recordings, heatmaps, funnels, automations and error tracking — each on or off',
                'Choose the pages recordings and heatmaps run on, and the ones they never touch',
                'Record a share of sessions, decided once per visit',
              ].map((point) => (
                <li key={point} className="landing-body flex items-start gap-3 text-foreground/90">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <ControlPanel />
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {PROMISES.map((promise) => (
            <div key={promise.title} className="landing-card p-6">
              <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <promise.icon className="h-5 w-5" />
              </span>
              <h3 className="mb-2 text-base font-semibold text-foreground">{promise.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{promise.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
