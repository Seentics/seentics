import { cn } from '@/lib/utils';

/**
 * The page a demo heatmap covers, with its heat layer.
 *
 * Shared by the landing page's heatmap preview and `/websites/demo/heatmaps/[slug]`.
 * The demo dashboard has no captured page snapshot — the tracker never ran on
 * anything — so that screen used to render click blobs floating over an empty grid
 * above the words "No screenshot yet", which showed a visitor the feature failing
 * rather than the feature.
 *
 * The real heat layer is a two-pass canvas (grayscale intensity, then a colour ramp)
 * driven by recorded points. Here the blobs are placed by hand over the things people
 * actually click. That is not a shortcut for want of data: the demo's own points were
 * unseeded `Math.random()` inside a 100–900px box, so they landed in the gaps between
 * elements and told the reader nothing. Anchoring each cluster to the element it
 * belongs to is what makes the picture mean something.
 *
 * The brand is invented. The page under a heatmap is the customer's own, and putting a
 * real company's pricing page here would misrepresent who uses Seentics.
 */

/**
 * One heat blob, in the ramp the canvas pass produces: red core out to cool blue.
 *
 * `left`/`top` default to the centre so it can be dropped straight inside the element
 * it belongs to — see `HotSpot`. Absolute coordinates were the first approach and they
 * drifted every time the page's length changed, which put clicks in the gaps between
 * buttons rather than on them.
 */
function Blob({
  left = '50%',
  top = '50%',
  size,
  strength = 1,
}: {
  left?: string;
  top?: string;
  size: number;
  /** Scales the core opacity — a proxy for the point's intensity. */
  strength?: number;
}) {
  return (
    <span
      // Marked so the scroll view can hide every blob with one selector on the root,
      // rather than threading a prop through two dozen call sites in the markup.
      data-blob=""
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
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
  { name: 'Starter', price: '$0', note: 'For side projects', cta: 'Start free', featured: false, heat: 0.5 },
  { name: 'Growth', price: '$29', note: 'For growing teams', cta: 'Choose Growth', featured: true, heat: 1 },
  { name: 'Scale', price: '$99', note: 'For high traffic', cta: 'Choose Scale', featured: false, heat: 0.24 },
];

/**
 * A click cluster sitting on the element it belongs to.
 *
 * The parent needs `relative`. Rendering the blob as a child rather than positioning
 * it against the page is what makes the placement exact: lengthening the page moves
 * the element and the heat together, instead of leaving the heat behind.
 */
function HotSpot({ size, strength = 1 }: { size: number; strength?: number }) {
  return <Blob size={size} strength={strength} />;
}

/** Design height of the page, in CSS px. Callers size their stage to match. */
export const DEMO_HEATMAP_PAGE_HEIGHT = 1560;

export function DemoHeatmapPage({ heat = 'click' }: { heat?: 'click' | 'scroll' }) {
  return (
    <div
      className={cn(
        'relative bg-white text-black',
        heat === 'scroll' && '[&_[data-blob]]:hidden',
      )}
      style={{ height: DEMO_HEATMAP_PAGE_HEIGHT }}
    >
      {/* Nav — every link and the CTA carries its own cluster */}
      <div className="flex items-center gap-4 border-b border-black/[0.07] px-6 py-4">
        <span className="text-[13px] font-black tracking-[0.18em] text-black/85">NORTHBOUND</span>
        <div className="flex-1" />
        <span className="relative text-[11px] font-medium text-black/55">
          Product
          <HotSpot size={46} strength={0.3} />
        </span>
        <span className="relative text-[11px] font-medium text-black/55">
          Pricing
          <HotSpot size={72} strength={0.62} />
        </span>
        <span className="relative text-[11px] font-medium text-black/55">
          Docs
          <HotSpot size={40} strength={0.22} />
        </span>
        <span className="relative rounded-lg bg-black px-3.5 py-1.5 text-[11px] font-semibold text-white">
          Get started
          <HotSpot size={104} />
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
        {/* Both halves of the billing toggle get clicked — people flip it to compare */}
        <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.03] p-0.5">
          <span className="relative rounded-full bg-white px-3 py-1 text-[10px] font-semibold shadow-sm">
            Monthly
            <HotSpot size={62} strength={0.42} />
          </span>
          <span className="relative px-3 py-1 text-[10px] font-medium text-black/50">
            Yearly · save 20%
            <HotSpot size={78} strength={0.66} />
          </span>
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
            {/* Each plan's own click volume — `heat` on the plan, so the featured
                one running hot and Scale barely being touched is data, not decoration */}
            <div
              className={cn(
                'relative mt-4 rounded-lg py-2 text-center text-[10px] font-semibold',
                plan.featured ? 'bg-black text-white' : 'border border-black/15 text-black/70',
              )}
            >
              {plan.cta}
              <HotSpot size={plan.featured ? 132 : 92} strength={plan.heat} />
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
        Scroll depth, when that view is selected.

        A scroll map is not a set of points — it is "what share of visitors ever saw
        this row", so it reads as bands down the page rather than blobs. The fold
        markers are the part people actually use: they say where attention stops.
      */}
      {heat === 'scroll' && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="absolute inset-x-0 top-0"
            style={{
              height: DEMO_HEATMAP_PAGE_HEIGHT,
              background: `linear-gradient(to bottom,
                rgba(255,32,32,0.42) 0%,
                rgba(255,140,0,0.40) 14%,
                rgba(255,235,0,0.36) 30%,
                rgba(60,220,60,0.30) 48%,
                rgba(20,110,255,0.22) 70%,
                rgba(20,110,255,0.10) 88%,
                rgba(20,110,255,0.05) 100%)`,
            }}
          />
          {[
            { at: '30%', label: '75% of visitors reached here' },
            { at: '58%', label: '42% reached here' },
            { at: '84%', label: '11% reached here' },
          ].map((fold) => (
            <div key={fold.at} className="absolute inset-x-0" style={{ top: fold.at }}>
              <div className="h-px w-full bg-black/45" />
              <span className="absolute right-3 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                {fold.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/*
        There used to be a second heat layer here: the same clusters again, positioned
        absolutely at percentages of the page. It was redundant with the anchored
        `HotSpot`s above, and it drifted exactly as this file's own note warned —
        rendered at the dashboard's width rather than the landing preview's, `top:
        41%` stopped being the plan CTAs and became the middle of the comparison
        strip, putting the single hottest blob on a row nobody clicks. Anchoring is
        the whole mechanism; a percentage layer cannot survive a width change.
      */}
    </div>
  );
}

