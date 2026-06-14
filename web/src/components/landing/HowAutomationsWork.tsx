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
} from 'lucide-react';
import Link from 'next/link';

const triggers = [
  { icon: MousePointer, label: 'Exit Intent', desc: 'Cursor leaves viewport', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  { icon: Globe, label: 'Page View', desc: 'Matches URL / path rules', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { icon: Target, label: 'Goal Reached', desc: 'Conversion or funnel hit', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { icon: Zap, label: 'Custom Event', desc: 'Any tracker event you fire', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
];

const actions = [
  { icon: MessageSquare, label: 'Show Popup', desc: 'Modal with CTA or offer', color: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
  { icon: Bell, label: 'Show Banner', desc: 'Top / bottom site banner', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  { icon: Webhook, label: 'Call Webhook', desc: 'HTTP POST to any URL', color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  { icon: Mail, label: 'Send Email', desc: 'Alert your team instantly', color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
  { icon: ArrowRight, label: 'Redirect', desc: 'Send visitor to another page', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
  { icon: Code2, label: 'Run Script', desc: 'Execute custom JavaScript', color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
];

const examples = [
  {
    trigger: { icon: MousePointer, label: 'Exit Intent', color: 'text-rose-500' },
    action: { icon: MessageSquare, label: 'Show Popup', color: 'text-violet-500' },
    title: 'Recover abandoning visitors',
    desc: 'When a visitor moves their cursor toward the browser tab, show a popup with a discount code or lead magnet before they leave.',
    tag: 'Conversion',
    tagColor: 'bg-rose-500/10 text-rose-500',
  },
  {
    trigger: { icon: Globe, label: 'Page View: /pricing', color: 'text-blue-500' },
    action: { icon: Webhook, label: 'Call Webhook', color: 'text-sky-500' },
    title: 'Alert your sales team in Slack',
    desc: 'Every time a visitor lands on your pricing page, fire a webhook to Slack or your CRM so your team can follow up while intent is high.',
    tag: 'Sales',
    tagColor: 'bg-blue-500/10 text-blue-500',
  },
  {
    trigger: { icon: Target, label: 'Goal Reached: Purchase', color: 'text-emerald-500' },
    action: { icon: Mail, label: 'Send Email', color: 'text-pink-500' },
    title: 'Trigger post-purchase flows',
    desc: "When a visitor hits your thank-you page, send an email to your team or trigger an upsell sequence via your email provider's webhook.",
    tag: 'Revenue',
    tagColor: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    trigger: { icon: Zap, label: 'Custom Event: video_played', color: 'text-amber-500' },
    action: { icon: Bell, label: 'Show Banner', color: 'text-indigo-500' },
    title: 'Nudge engaged visitors',
    desc: 'When someone plays your demo video, show a banner offering a free trial or live demo call — strike while interest is at its peak.',
    tag: 'Engagement',
    tagColor: 'bg-amber-500/10 text-amber-500',
  },
];

export default function HowAutomationsWork() {
  return (
    <section className="py-24 md:py-32 bg-background border-t border-border/40">
      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400 mb-4">
            <Zap className="h-3 w-3" />
            Automations
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            When visitors act,<br />
            <span className="text-primary">your site acts back</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Connect any visitor behavior to any action — no developer needed. Build workflows visually and deploy in seconds.
          </p>
        </div>

        {/* Trigger → Action visual */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-start">

            {/* Triggers */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">Triggers</p>
              <div className="space-y-2">
                {triggers.map((t) => (
                  <div key={t.label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${t.color}`}>
                    <t.icon className={`h-4 w-4 shrink-0 ${t.color.split(' ')[0]}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-none">{t.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center pt-8 md:pt-12">
              <div className="flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">then</span>
              </div>
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">Actions</p>
              <div className="space-y-2">
                {actions.map((a) => (
                  <div key={a.label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${a.color}`}>
                    <a.icon className={`h-4 w-4 shrink-0 ${a.color.split(' ')[0]}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-none">{a.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Example recipes */}
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-8">Real-world examples</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {examples.map((ex) => (
              <div key={ex.title} className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4 hover:border-primary/30 hover:bg-accent/20 transition-colors">

                {/* Flow pill */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border bg-background ${ex.trigger.color} border-current/20`}>
                    <ex.trigger.icon className="h-3 w-3" />
                    {ex.trigger.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border bg-background ${ex.action.color} border-current/20`}>
                    <ex.action.icon className="h-3 w-3" />
                    {ex.action.label}
                  </span>
                  <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ex.tagColor}`}>{ex.tag}</span>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-1">{ex.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ex.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <p className="text-muted-foreground text-sm mb-4">Build your first automation in under 2 minutes — drag, drop, done.</p>
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
