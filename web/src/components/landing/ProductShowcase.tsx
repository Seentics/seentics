import { MoveHorizontal } from 'lucide-react';
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
 * Below `lg` it keeps its width and scrolls sideways rather than being shrunk to fit.
 * A 1560px screen squeezed into a phone puts the scale factor under 0.25, where every
 * label is 3px of grey — a smear that says less than no image at all.
 */
export default function ProductShowcase() {
  return (
    <section className="landing-section relative !pt-0">
      {/* No wash behind the shot. There was a `from-primary/[0.05]` gradient here,
          which put a blue cast on the one element that has to read as a photograph of
          a screen — the laptop's own shadow is what should separate it from the page. */}
      <div className="landing-container relative z-10">
        {/* No width of its own — the shot shares the page's measure, so the laptop
            lines up with the headings above and the sections below instead of being
            the one element that runs wider than everything else. */}
        {/* Below `lg` the shot keeps a fixed 1180px width and scrolls sideways
            rather than vanishing. Fitting a 1560px dashboard into a phone puts the
            scale under 0.25, where every label is a smear. */}
        <div className="-mx-6 overflow-x-auto px-6 pb-3 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="w-[1180px] lg:w-auto">
            <MacbookFrame
              designWidth={1560}
              designHeight={975}
              url="app.seentics.com/websites/acme-store"
            >
              <DashboardMock />
            </MacbookFrame>
          </div>
        </div>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground lg:hidden">
          <MoveHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Swipe to see the whole dashboard
        </p>
      </div>
    </section>
  );
}
