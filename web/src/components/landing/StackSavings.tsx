import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

/**
 * Under the pricing cards: what the same job costs as separate tools, against Seentics Pro.
 *
 * The figures are typical entry prices of well-known tools in each category (a privacy-first
 * analytics service, a replay and heatmap tool, a popup tool), read from public pricing
 * summaries in October 2026. They move with traffic and billing period, which the footnote says;
 * no vendor is named, so nothing here quotes a specific company's page. Recheck before changing.
 */
const STACK = [
  { name: 'Web analytics', detail: 'Privacy-friendly pageviews, sources, goals', price: 'from about $9' },
  { name: 'Session replay & heatmaps', detail: 'Recordings, click and scroll maps', price: 'from about $25 to $39' },
  { name: 'Popups & lead capture', detail: 'Exit-intent popups and forms that send to your tools', price: 'from about $25' },
] as const;

export default function StackSavings() {
  return (
    <section className="mx-auto mt-20 w-full max-w-[68rem]" aria-labelledby="stack-savings">
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="stack-savings" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          One tool instead of three
        </h2>
        <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
          Most small teams end up paying for web analytics, session replay and popups separately.
          Seentics Pro does all three in one plan, and costs less than any two of them together.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Separate tools, typical entry prices</p>
          <ul className="mt-4 divide-y divide-border">
            {STACK.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-4 py-3.5">
                <span>
                  <span className="block text-[15px] font-semibold text-foreground">{t.name}</span>
                  <span className="block text-[13px] text-muted-foreground">{t.detail}</span>
                </span>
                <span className="shrink-0 text-[14px] font-medium text-muted-foreground">{t.price} <span className="text-[12px]">/mo</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
            <span className="text-[14px] font-semibold text-foreground">Together</span>
            <span className="text-[20px] font-bold tracking-tight text-foreground">about $59 to $73<span className="ml-1 text-[13px] font-medium text-muted-foreground">/mo</span></span>
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">Before funnels, automations, AI or server logs, which are extra tools again.</p>
        </div>

        <div className="flex flex-col rounded-2xl border border-primary bg-primary/[0.04] p-6 ring-1 ring-primary">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Seentics Pro</p>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold tracking-tight text-foreground">$19</span>
            <span className="text-sm text-muted-foreground">/month, or $14 billed yearly</span>
          </p>
          <ul className="mt-5 space-y-2.5 text-[14px]">
            {['Web analytics, goals and funnels', 'Session replay and heatmaps', 'Popups and forms that send to your tools', 'Automations and AI analyses', 'Logs, traces and error tracking'].map((f) => (
              <li key={f} className="flex gap-2.5 text-foreground/90">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline">
            Start free, upgrade when you need to <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-[12.5px] leading-relaxed text-muted-foreground">
        Typical entry prices of popular tools in each category, October 2026, in US dollars. Prices depend on traffic and billing period; check current pricing before you compare.
      </p>
    </section>
  );
}
