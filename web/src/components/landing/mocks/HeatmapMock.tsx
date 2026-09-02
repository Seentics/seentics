import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Lock,
  MousePointer,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MockSidebar } from './MockSidebar';

/**
 * A click heatmap over a page.
 *
 * Mirrors `app/websites/[websiteId]/heatmaps/[slug]/page.tsx`: the header with the
 * point count and path, the Clicks/Scroll and device controls, the near-black stage,
 * and the browser chrome the preview is rendered inside — traffic lights, inert
 * back/forward, and the mono URL bar with its lock.
 *
 * The real heat layer is a two-pass canvas (grayscale intensity, then colour ramp)
 * driven by recorded points. Here the blobs are placed by hand over the things people
 * actually click — nav, primary CTA, the cards — because the alternative is shipping a
 * canvas renderer and a point set to a marketing page.
 */

/** One heat blob, in the ramp the canvas pass produces: red core out to cool blue. */
function Blob({
  left,
  top,
  size,
  strength = 1,
}: {
  left: string;
  top: string;
  size: number;
  /** Scales the core opacity — a proxy for the point's intensity. */
  strength?: number;
}) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left,
        top,
        width: size,
        height: size,
        background: `radial-gradient(circle,
          rgba(255,32,32,${0.85 * strength}) 0%,
          rgba(255,140,0,${0.7 * strength}) 24%,
          rgba(255,235,0,${0.55 * strength}) 44%,
          rgba(60,220,60,${0.34 * strength}) 64%,
          rgba(20,110,255,${0.16 * strength}) 82%,
          rgba(20,110,255,0) 100%)`,
        filter: 'blur(3px)',
      }}
    />
  );
}

/**
 * The page under the heat layer.
 *
 * The toolbar says "Screenshot", so this has to look like a captured page rather than
 * a wireframe — grey bars read as a skeleton and make the heat look like it is sitting
 * on nothing. The brand is invented: the page a heatmap covers is the customer's, and
 * putting a real company's pricing page here would misrepresent who uses Seentics.
 *
 * The URL bar says /pricing, so this is a pricing page — which is also where the blob
 * placement earns its keep: the heat lands on the plan CTAs, and the third plan's
 * button is visibly colder than the second's.
 */

const PLANS = [
  { name: 'Starter', price: '$0', note: 'For side projects', cta: 'Start free', featured: false },
  { name: 'Growth', price: '$29', note: 'For growing teams', cta: 'Choose Growth', featured: true },
  { name: 'Scale', price: '$99', note: 'For high traffic', cta: 'Choose Scale', featured: false },
];

function PreviewPage() {
  return (
    <div className="relative bg-white text-black" style={{ height: 1180 }}>
      {/* Nav */}
      <div className="flex items-center gap-4 border-b border-black/[0.07] px-6 py-4">
        <span className="text-[13px] font-black tracking-[0.18em] text-black/85">NORTHBOUND</span>
        <div className="flex-1" />
        <span className="text-[11px] font-medium text-black/55">Product</span>
        <span className="text-[11px] font-medium text-black/55">Pricing</span>
        <span className="text-[11px] font-medium text-black/55">Docs</span>
        <span className="rounded-lg bg-black px-3.5 py-1.5 text-[11px] font-semibold text-white">
          Get started
        </span>
      </div>

      {/* Hero */}
      <div className="px-6 pt-9 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">Pricing</p>
        <p className="mt-2 text-[22px] font-extrabold tracking-tight text-black/90">
          Simple plans, no surprises
        </p>
        <p className="mx-auto mt-2 max-w-[22rem] text-[11px] leading-relaxed text-black/55">
          Every plan includes the full product. Pay for the traffic you actually get, and
          change plan whenever you like.
        </p>
        <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.03] p-0.5">
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold shadow-sm">Monthly</span>
          <span className="px-3 py-1 text-[10px] font-medium text-black/50">Yearly · save 20%</span>
        </div>
      </div>

      {/* Plans */}
      <div className="mt-7 grid grid-cols-3 gap-4 px-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              'rounded-lg border p-4',
              plan.featured ? 'border-black/25 shadow-sm' : 'border-black/[0.08]',
            )}
          >
            <p className="text-[11px] font-bold text-black/80">{plan.name}</p>
            <p className="text-[9px] text-black/45">{plan.note}</p>
            <p className="mt-3 text-[20px] font-extrabold tracking-tight text-black/90">
              {plan.price}
              <span className="text-[10px] font-medium text-black/40"> /mo</span>
            </p>
            <div className="mt-3 space-y-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/25" />
                  <span className="h-1.5 flex-1 rounded-full bg-black/[0.07]" />
                </div>
              ))}
            </div>
            <div
              className={cn(
                'mt-4 rounded-lg py-2 text-center text-[10px] font-semibold',
                plan.featured ? 'bg-black text-white' : 'border border-black/15 text-black/70',
              )}
            >
              {plan.cta}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison strip */}
      <div className="mt-9 border-t border-black/[0.06] px-6 pt-7">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">
          Compare plans
        </p>
        <div className="mt-4 space-y-2">
          {['Websites', 'Events per month', 'Data retention', 'Session recordings', 'Team members'].map(
            (row) => (
              <div key={row} className="flex items-center gap-3 rounded border border-black/[0.05] px-3 py-2">
                <span className="w-40 shrink-0 text-[10px] font-medium text-black/70">{row}</span>
                <span className="h-1.5 flex-1 rounded-full bg-black/[0.06]" />
                <span className="h-1.5 w-16 shrink-0 rounded-full bg-black/[0.06]" />
                <span className="h-1.5 w-16 shrink-0 rounded-full bg-black/[0.06]" />
              </div>
            ),
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-9 px-6">
        <p className="text-[13px] font-bold tracking-tight text-black/80">Common questions</p>
        <div className="mt-3 space-y-2">
          {['Can I change plan later?', 'What counts as an event?', 'Do you offer refunds?'].map((q) => (
            <div key={q} className="flex items-center justify-between rounded border border-black/[0.06] px-3 py-2.5">
              <span className="text-[11px] font-medium text-black/70">{q}</span>
              <span className="text-[13px] leading-none text-black/25">+</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer — the bottom of a real page, which is why the scroll map matters */}
      <div className="mt-9 border-t border-black/[0.07] bg-black/[0.015] px-6 py-6">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <span className="text-[11px] font-black tracking-[0.16em] text-black/70">NORTHBOUND</span>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 w-24 rounded-full bg-black/[0.07]" />
              <div className="h-1.5 w-20 rounded-full bg-black/[0.07]" />
            </div>
          </div>
          {['Product', 'Company', 'Legal'].map((col) => (
            <div key={col}>
              <p className="text-[10px] font-semibold text-black/60">{col}</p>
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 w-16 rounded-full bg-black/[0.06]" />
                <div className="h-1.5 w-14 rounded-full bg-black/[0.06]" />
                <div className="h-1.5 w-16 rounded-full bg-black/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/*
        Heat layer — sits over the page, as the canvas does.

        Placement carries the story the section claims: hot on the nav CTA and the
        featured plan's button, cooler on the plan either side of it, and almost
        nothing past the comparison strip — which is the point of a scroll map.
      */}
      <div className="pointer-events-none absolute inset-0">
        {/* Nav CTA and the pricing link: the two things people reach for first. */}
        <Blob left="90%" top="2.6%" size={104} />
        <Blob left="72%" top="2.6%" size={72} strength={0.55} />
        {/* The billing toggle. */}
        <Blob left="47%" top="16%" size={76} strength={0.5} />
        {/* Plan CTAs — the featured one runs hot, Scale barely gets touched. */}
        <Blob left="50%" top="41%" size={132} strength={0.95} />
        <Blob left="17%" top="41%" size={86} strength={0.45} />
        <Blob left="83%" top="41%" size={58} strength={0.22} />
        {/* Below the plans attention falls away fast. */}
        <Blob left="30%" top="58%" size={62} strength={0.22} />
        <Blob left="52%" top="76%" size={54} strength={0.16} />
      </div>
    </div>
  );
}

/** The preview's browser chrome — the real page renders the site inside one. */
function BrowserChrome() {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800/90 bg-zinc-900 px-1.5">
      <div className="flex shrink-0 gap-1 px-0.5">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
      </div>
      <span className="shrink-0 rounded-lg p-1 text-zinc-600 opacity-60">
        <ChevronLeft className="h-3.5 w-3.5" />
      </span>
      <span className="shrink-0 rounded-lg p-1 text-zinc-600 opacity-60">
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-2 py-0.5">
        <Lock className="h-3 w-3 shrink-0 text-emerald-500/90" />
        <p className="min-w-0 truncate font-mono text-[11px] leading-snug text-zinc-400">
          <span className="text-zinc-500">acmestore.com</span>
          <span className="text-zinc-400">/pricing</span>
        </p>
      </div>
      <span className="shrink-0 rounded-lg p-1.5 text-zinc-400">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function SegmentedControl({
  items,
  active,
}: {
  items: Array<{ icon: typeof MousePointer; label: string }>;
  active: string;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-background p-0.5">
      {items.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className={cn(
            'flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs font-medium',
            label === active ? 'bg-muted text-foreground' : 'text-muted-foreground',
          )}
        >
          <Icon className="h-3 w-3 opacity-80" />
          {label}
        </span>
      ))}
    </div>
  );
}

export function HeatmapMock() {
  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <MockSidebar active="Heatmaps" />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Heatmaps
            </span>

            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0 tabular-nums">12,481 pts</span>
              <span className="shrink-0 text-border">·</span>
              <code className="min-w-0 truncate font-mono text-[11px]">/pricing</code>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground">
                <Link2 className="h-3.5 w-3.5" />
              </span>
              <SegmentedControl
                items={[
                  { icon: MousePointer, label: 'Clicks' },
                  { icon: TrendingDown, label: 'Scroll' },
                ]}
                active="Clicks"
              />
              <span className="flex h-8 w-32 items-center rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground">
                Desktop
              </span>
              <SegmentedControl
                items={[
                  { icon: ImageIcon, label: 'Screenshot' },
                  { icon: MousePointer, label: 'Heat only' },
                ]}
                active="Screenshot"
              />
            </div>
          </div>
        </header>

        {/* Stage — always near-black, as the real preview surface is */}
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-[#09090b] p-5">
          <div className="w-full max-w-[720px] overflow-hidden rounded-lg border border-zinc-800 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
            <BrowserChrome />
            <PreviewPage />
          </div>
        </div>
      </main>
    </div>
  );
}
