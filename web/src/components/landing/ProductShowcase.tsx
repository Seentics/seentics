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
      {/* Soft wash carrying down from the hero, so the shot sits in light rather
          than on a flat band. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/[0.05] to-transparent" />

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
