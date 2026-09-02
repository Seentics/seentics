import { MacbookFrame } from './mocks/MacbookFrame';
import { DashboardMock } from './mocks/DashboardMock';

/**
 * The product, immediately after the promise.
 *
 * The hero says what Seentics does; this says what it looks like — the real
 * dashboard, real charts, real sidebar, one scroll below the headline. It is the
 * page's single most persuasive element, which is why it gets the full container
 * width and nothing else competes with it.
 *
 * Below `lg` it is hidden rather than shrunk. The shot is a 1560px screen: at phone
 * width the scale factor drops under 0.25 and every label becomes 3px of grey — a
 * smear that says less than no image at all.
 */
export default function ProductShowcase() {
  return (
    <section className="landing-section relative hidden !pt-0 lg:block">
      {/* No wash behind the shot. There was a `from-primary/[0.05]` gradient here,
          which put a blue cast on the one element that has to read as a photograph of
          a screen — the laptop's own shadow is what should separate it from the page. */}
      <div className="landing-container relative z-10">
        {/* No width of its own — the shot shares the page's measure, so the laptop
            lines up with the headings above and the sections below instead of being
            the one element that runs wider than everything else. */}
        <div>
          <MacbookFrame
            designWidth={1560}
            designHeight={975}
            url="app.seentics.com/websites/acme-store"
          >
            <DashboardMock />
          </MacbookFrame>
        </div>
      </div>
    </section>
  );
}
