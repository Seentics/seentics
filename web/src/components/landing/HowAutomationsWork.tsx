import {
  MousePointer,
  Globe,
  Zap,
  Target,
  Webhook,
  Mail,
  Bell,
  MessageSquare,
  ArrowRight,
  Code2,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const triggers = [
  { icon: MousePointer, label: 'Exit Intent',   desc: 'Cursor leaves viewport',     color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/25' },
  { icon: Globe,        label: 'Page View',      desc: 'Matches URL / path rules',   color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25' },
  { icon: Target,       label: 'Goal Reached',   desc: 'Conversion or funnel hit',   color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  { icon: Zap,          label: 'Custom Event',   desc: 'Any event you fire',         color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25' },
];

const actions = [
  { icon: MessageSquare, label: 'Show Popup',   desc: 'Modal with CTA or offer',  color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/25' },
  { icon: Bell,          label: 'Show Banner',  desc: 'Top / bottom banner',      color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/25' },
  { icon: Webhook,       label: 'Call Webhook', desc: 'HTTP POST to any URL',     color: 'text-sky-500',    bg: 'bg-sky-500/10',    border: 'border-sky-500/25' },
  { icon: Mail,          label: 'Send Email',   desc: 'Alert your team instantly', color: 'text-pink-500',   bg: 'bg-pink-500/10',   border: 'border-pink-500/25' },
  { icon: ArrowRight,    label: 'Redirect',     desc: 'Send to another page',     color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/25' },
  { icon: Code2,         label: 'Run Script',   desc: 'Execute custom JS',        color: 'text-teal-500',   bg: 'bg-teal-500/10',   border: 'border-teal-500/25' },
];

const recipes = [
  {
    trigger: { icon: MousePointer, label: 'Exit Intent',       color: 'text-rose-500',    bg: 'bg-rose-500/10' },
    action:  { icon: MessageSquare, label: 'Show Popup',       color: 'text-violet-500',  bg: 'bg-violet-500/10' },
    title: 'Recover abandoning visitors',
    desc: 'When a visitor moves their cursor toward the browser tab, show a popup with a discount code before they leave.',
    tag: 'Conversion',
    accent: 'bg-rose-500/50',
  },
  {
    trigger: { icon: Globe,   label: 'Page View: /pricing',   color: 'text-blue-500',    bg: 'bg-blue-500/10' },
    action:  { icon: Webhook, label: 'Call Webhook',          color: 'text-sky-500',     bg: 'bg-sky-500/10' },
    title: 'Alert sales when intent is high',
    desc: 'Every time someone lands on your pricing page, ping your Slack channel so the team can follow up while intent is hot.',
    tag: 'Sales',
    accent: 'bg-blue-500/50',
  },
  {
    trigger: { icon: Target, label: 'Goal: Purchase',          color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    action:  { icon: Mail,   label: 'Send Email',              color: 'text-pink-500',    bg: 'bg-pink-500/10' },
    title: 'Trigger post-purchase flows',
    desc: "When a visitor hits your thank-you page, fire an upsell email or alert your ops team automatically.",
    tag: 'Revenue',
    accent: 'bg-emerald-500/50',
  },
  {
    trigger: { icon: Zap,  label: 'Custom: video_played',     color: 'text-amber-500',   bg: 'bg-amber-500/10' },
    action:  { icon: Bell, label: 'Show Banner',              color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
    title: 'Nudge engaged visitors',
    desc: 'When someone plays your demo video, show a banner offering a free trial — strike while their interest is at its peak.',
    tag: 'Engagement',
    accent: 'bg-amber-500/50',
  },
];

export default function HowAutomationsWork() {
  return (
    <section className="py-24 md:py-32 bg-muted/20 border-t border-border/40 overflow-hidden">
      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 mb-4">
            <Zap className="h-3 w-3" />
            Automations
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Your site reacts<br />
            <span className="text-primary">to every visitor action</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Connect any visitor behavior to any action — no code required. Build rules visually, deploy in seconds.
          </p>
        </div>

        {/* Builder UI mock */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xl shadow-black/[0.05]">

            {/* Window chrome */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-500/50" />
                <div className="h-3 w-3 rounded-full bg-amber-500/50" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/50" />
              </div>
              <span className="text-xs font-medium text-muted-foreground ml-1">
                Automation Builder — Exit Intent → Show Popup
              </span>
              <div className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_72px_1fr] gap-4 md:gap-6 items-center">

                {/* Triggers */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    When this happens
                  </p>
                  <div className="space-y-2">
                    {triggers.map((t, i) => (
                      <div
                        key={t.label}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all ${
                          i === 0
                            ? `${t.bg} ${t.border}`
                            : 'bg-background/50 border-border/25 opacity-40'
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${t.bg}`}>
                          <t.icon className={`h-4 w-4 ${t.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground leading-none">{t.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                        </div>
                        {i === 0 && <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow connector */}
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="h-12 w-12 rounded-full bg-primary shadow-lg shadow-primary/25 flex items-center justify-center">
                      <ArrowRight className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Then</span>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Do this automatically
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {actions.map((a, i) => (
                      <div
                        key={a.label}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 transition-all ${
                          i === 0
                            ? `${a.bg} ${a.border}`
                            : 'bg-background/50 border-border/25 opacity-40'
                        }`}
                      >
                        <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${a.bg}`}>
                          <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-none truncate">{a.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{a.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Recipe cards */}
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-border/40" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Popular recipes</p>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((r) => (
              <div
                key={r.title}
                className="group relative rounded-xl bg-card border border-border/50 p-5 overflow-hidden hover:border-border hover:shadow-sm transition-all"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${r.accent}`} />

                <div className="flex items-center gap-2 mb-3">
                  <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${r.trigger.bg}`}>
                    <r.trigger.icon className={`h-3 w-3 ${r.trigger.color}`} />
                    <span className={`text-[10px] font-bold ${r.trigger.color}`}>{r.trigger.label}</span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${r.action.bg}`}>
                    <r.action.icon className={`h-3 w-3 ${r.action.color}`} />
                    <span className={`text-[10px] font-bold ${r.action.color}`}>{r.action.label}</span>
                  </div>
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">
                    {r.tag}
                  </span>
                </div>

                <h3 className="font-semibold text-sm text-foreground mb-1.5">{r.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <p className="text-muted-foreground text-sm mb-4">
            Build your first automation in under 2 minutes — no code required.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start automating free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </section>
  );
}
