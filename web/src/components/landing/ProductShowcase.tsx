import { MacbookFrame } from './mocks/MacbookFrame';
import { DashboardMock } from './mocks/DashboardMock';

/**
 * Design width of the shot, and the column it is scaled into.
 *
 * The frame's own chrome eats 24px of that column — the lid's `p-[7px]` and the
 * bezel's `px-[5px]`, both sides — so the screen is narrower than the column by that
 * much, and the scale is measured against the screen.
 */
const DESIGN_W = 1440;
const DESIGN_H = 1010;
const COLUMN_W = 980;
const FRAME_CHROME_X = 2 * 7 + 2 * 5;

/** What the frame's own measurement will arrive at, once the column is at full width. */
const SSR_SCALE = (COLUMN_W - FRAME_CHROME_X) / DESIGN_W;

/**
 * The product, immediately after the promise.
 *
 * The hero says what Seentics does; this says what it looks like — the real
 * dashboard, real charts, real sidebar, one scroll below the headline. It is the
 * page's single most persuasive element, which is why it gets the full container
 * width and nothing else competes with it.
 *
 * It scales to the column at every width, phone included, so on a small screen the
 * laptop is small and the numbers inside it are not readable. That is on purpose: the
 * shot is there to show the shape of the product, and a whole dashboard at a glance
 * does that better than a fragment of one blown up, or a page that scrolls sideways.
 */
export default function ProductShowcase() {
  return (
    <section className="landing-section relative !pt-0">
      {/* No wash behind the shot. There was a `from-primary/[0.05]` gradient here,
          which put a blue cast on the one element that has to read as a photograph of
          a screen — the laptop's own shadow is what should separate it from the page. */}
      <div className="landing-container relative z-10">
        {/*
          1440x1010 rather than 1560x975.

          At 16:10 the shot read as a wide letterbox — a lot of width for the height,
          which made the dashboard inside feel small however big the frame got. Pulling
          the width in and the height up lands near 3:2: less wide, and the same page
          gets more vertical room, so the content reads larger at the same frame size.
        */}
        {/*
          Server-rendered, unlike the four mocks below the fold.

          This one is the page's LCP element, and deferring it meant the shot only
          existed after the bundle had downloaded, hydrated and then fetched a further
          chunk — so the first thing a visitor saw was an empty laptop, and no amount of
          edge caching could help, because the markup was not in the HTML to cache. It
          is now, and `ssrScale` lets it paint before hydration.

          The cost is recharts, which `TrafficOverview` pulls in: it is back in the
          bundle this page's LCP depends on. Everything else in the mock — the sidebar,
          the header, the summary cards, top pages and top sources — is library-free and
          paints from the HTML. Recharts' `ResponsiveContainer` measures before it draws,
          so the traffic chart's own plot area is the one part that still waits for
          hydration, inside a shot that is otherwise already there.
        */}
        <div className="mx-auto" style={{ maxWidth: COLUMN_W }}>
          <MacbookFrame
            designWidth={DESIGN_W}
            designHeight={DESIGN_H}
            ssrScale={SSR_SCALE}
            url="app.seentics.com/websites/acme-store"
          >
            <DashboardMock />
          </MacbookFrame>
        </div>
      </div>
    </section>
  );
}
