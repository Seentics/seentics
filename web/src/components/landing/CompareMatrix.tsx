import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * What you would buy, and what replaces it.
 *
 * Each row is one job. The middle column shows the real tools people use for it, with the
 * vendors' own logos; the right column shows the one Seentics product that covers it. The
 * logos are the point of the table: they make "a stack of tools" something you can see.
 *
 * It names tools as examples of a category. It says nothing about what any vendor lacks,
 * so there is no feature matrix to keep true. Logos are simple-icons marks in
 * public/images/competitor, drawn in each brand's colour (lighter in dark mode).
 */
type Tool = { name: string; logo?: string; color: string; dark: string };

const GA: Tool = { name: 'Google Analytics', logo: '/images/competitor/googleanalytics.svg', color: '#E37400', dark: '#F29B38' };
const PLAUSIBLE: Tool = { name: 'Plausible', logo: '/images/competitor/plausibleanalytics.svg', color: '#5850EC', dark: '#8F89F5' };
const HOTJAR: Tool = { name: 'Hotjar', logo: '/images/competitor/hotjar.svg', color: '#FD3A5C', dark: '#FD3A5C' };
const DATADOG: Tool = { name: 'Datadog', logo: '/images/competitor/datadog.svg', color: '#632CA6', dark: '#A883E0' };
const BETTERSTACK: Tool = { name: 'Better Stack', logo: '/images/competitor/betterstack.svg', color: '#1A1A1A', dark: '#FFFFFF' };

const ROWS: { job: string; tools: Tool[]; other?: string; product: string; color: string }[] = [
  { job: 'Web analytics and funnels', tools: [GA, PLAUSIBLE], product: 'Analytics', color: 'hsl(var(--primary))' },
  { job: 'Session replay and heatmaps', tools: [HOTJAR], product: 'Analytics', color: 'hsl(var(--primary))' },
  { job: 'Behavior-triggered automations', tools: [], other: 'A separate popup or automation tool', product: 'Analytics', color: 'hsl(var(--primary))' },
  { job: 'Logs, metrics and traces', tools: [DATADOG], product: 'Observability', color: 'hsl(267 60% 52%)' },
  { job: 'Uptime monitoring and status pages', tools: [BETTERSTACK], product: 'Uptime', color: 'hsl(145 72% 38%)' },
];

function ToolChip({ tool }: { tool: Tool }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
      {tool.logo && (
        <span
          aria-hidden
          className="cmp-logo inline-block h-4 w-4 shrink-0"
          style={{
            ['--c' as string]: tool.color,
            ['--cd' as string]: tool.dark,
            WebkitMaskImage: `url(${tool.logo})`,
            maskImage: `url(${tool.logo})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        />
      )}
      <span className="text-[13px] font-medium text-foreground">{tool.name}</span>
    </span>
  );
}

export default function CompareMatrix() {
  return (
    <section id="compare" className="landing-section">
      <style>{`.cmp-logo{background:var(--c)}.dark .cmp-logo{background:var(--cd)}`}</style>
      <div className="landing-container">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="landing-eyebrow">Why Seentics</p>
          <h2 className="mb-2 text-balance text-2xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Five tools. One platform.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Each job below usually means another product, another login and another bill.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.8fr)]">
          {/* Column heads */}
          <div className="hidden border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:block">
            The job
          </div>
          <div className="hidden border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:block">
            What you would buy
          </div>
          <div className="hidden border-b border-primary/20 bg-primary px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground md:block">
            With Seentics
          </div>

          {ROWS.map((row, i) => {
            const last = i === ROWS.length - 1;
            return (
              <div key={row.job} className="contents">
                <div className={cn('flex items-center px-5 pb-1 pt-4 text-[15px] font-semibold text-foreground md:py-5', !last && 'md:border-b md:border-border')}>
                  {row.job}
                </div>
                <div className={cn('flex flex-wrap items-center gap-2 px-5 pb-3 md:py-5', !last && 'md:border-b md:border-border')}>
                  {row.tools.map((t) => (
                    <ToolChip key={t.name} tool={t} />
                  ))}
                  {row.other && <span className="text-[13px] text-muted-foreground">{row.other}</span>}
                </div>
                <div
                  className={cn(
                    'flex items-center gap-2.5 bg-primary/[0.07] px-5 pb-4 pt-1 md:py-5',
                    !last && 'border-b border-border',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: row.color }}>
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[15px] font-bold" style={{ color: row.color }}>
                    {row.product}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Totals */}
          <div className="border-t border-border bg-muted/40 px-5 py-4 text-sm font-semibold text-foreground">The total</div>
          <div className="border-t border-border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">5 tools,</span> 5 logins, 5 bills
          </div>
          <div className="flex items-center gap-2 border-t border-primary/20 bg-primary/[0.12] px-5 py-4 text-sm font-bold text-foreground">
            <span>1 platform</span>
            <ArrowRight className="h-4 w-4 text-primary" />
          </div>
        </div>

        <p className="mx-auto mt-3 max-w-4xl text-center text-[11px] text-muted-foreground">
          Tools shown are common examples of each category, not a ranking. Logos are trademarks of their owners.
        </p>
      </div>
    </section>
  );
}
