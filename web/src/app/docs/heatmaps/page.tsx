import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Heatmaps · Seentics docs',
  description: 'Where visitors click and how far they scroll, rendered over the page itself.',
};

/** New route: heatmaps were in the sidebar but had no page, only an anchor section. */
export default function HeatmapsPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Heatmaps"
      lead="Rendered over the page itself, so “nobody sees the second CTA” stops being a hunch."
    >
      <DocSection title="Two maps">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Clicks</strong> — where people actually
            click, including the things that are not links.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Scroll</strong> — how far down the page
            visitors get, so you can see where attention stops.
          </Li>
        </Ul>
        <P>
          Both are split by device, because a desktop click map and a mobile one rarely tell the
          same story.
        </P>
      </DocSection>

      <DocSection title="How the page underneath is shown">
        <P>
          Seentics renders your live page inside the viewer and draws the heat layer over it. You can
          switch to <C>Heat only</C> to see the data on its own — useful when the page has changed
          since the data was collected and the overlay no longer lines up.
        </P>
        <Callout kind="note" title="Heatmaps come from recording data">
          Click and scroll points are derived from the same event stream as replays, so a page needs
          traffic with recording enabled before a map has anything to show.
        </Callout>
      </DocSection>

      <DocSection title="Reading a map">
        <Ul>
          <Li>
            Red is the highest concentration of clicks in that map, not an absolute number — a busy
            page and a quiet one both have a red spot.
          </Li>
          <Li>
            The point count is shown in the header. A map built from a few dozen points is an
            anecdote, not a finding.
          </Li>
          <Li>
            Compare like with like: filter to one device before drawing conclusions about placement.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Excluding elements">
        <P>
          Elements marked <C>data-seentics-block</C> are not captured, so they will not appear in a
          heatmap either. See the{' '}
          <Link href="/docs/tracker" className="text-primary hover:underline">tracker reference</Link>.
        </P>
      </DocSection>
    </DocPage>
  );
}
