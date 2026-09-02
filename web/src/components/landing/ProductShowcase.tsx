import { MacbookFrame } from './mocks/MacbookFrame';
import { LazyDashboardMock } from './mocks/lazy';

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
        <div className="mx-auto max-w-[1150px]">
          <MacbookFrame
            designWidth={1440}
            designHeight={1010}
            url="app.seentics.com/websites/acme-store"
          >
            <LazyDashboardMock />
          </MacbookFrame>
        </div>
      </div>
    </section>
  );
}
