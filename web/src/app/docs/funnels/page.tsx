import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Funnels · Seentics docs',
  description: 'Define the path you expect visitors to take, then find the step that loses them.',
};

export default function FunnelsPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Funnels"
      lead="Define the path you expect, then watch where visitors leave it."
    >
      <DocSection title="Building one">
        <P>
          A funnel is an ordered list of steps. Each step matches either a page or an event, and they
          are evaluated in order — a visitor reaches step three only by having passed steps one and
          two.
        </P>
        <RefTable
          columns={['Step type', 'Matches on']}
          rows={[
            [<C>page</C>, 'A path, such as /pricing. Wildcards are supported, so /blog/* covers every post.'],
            [<C>event</C>, <span>A custom event name you send with <C>seentics.track()</C>.</span>],
            [<C>custom</C>, 'A condition you define, for cases the other two do not cover.'],
          ]}
        />
        <CodeBlock
          language="js"
          filename="checkout.js"
          code={`// Makes 'signup_complete' usable as a funnel step.
seentics.track('signup_complete');`}
        />
      </DocSection>

      <DocSection title="What the report tells you">
        <P>
          Two percentages per step, and the difference between them is the whole point of the page.
        </P>
        <RefTable
          columns={['Figure', 'Means']}
          rows={[
            ['% of entries', 'Share of everyone who entered the funnel that reached this step. Falls away down the funnel.'],
            ['% continued', 'Share of the previous step that carried on to this one. This is the one that finds a broken transition.'],
            ['Left here', 'How many people reached the previous step and did not reach this one.'],
          ]}
        />
        <Callout kind="tip" title="Why “% continued” is the useful one">
          A late step can look fine against total entries simply because few people get that far,
          while losing most of the visitors who actually reach it. The funnel view calls out the
          biggest single drop-off for exactly this reason.
        </Callout>
      </DocSection>

      <DocSection title="Then go and look">
        <Ul>
          <Li>
            Watch{' '}
            <Link href="/docs/session-replays" className="text-primary hover:underline">
              replays
            </Link>{' '}
            of sessions that reached the weak step and stopped.
          </Li>
          <Li>
            Check the{' '}
            <Link href="/docs/heatmaps" className="text-primary hover:underline">heatmap</Link> for
            that page — often the next action is below where anyone scrolls.
          </Li>
          <Li>
            Then set up an{' '}
            <Link href="/docs/automations" className="text-primary hover:underline">automation</Link>{' '}
            that responds when someone is about to drop out.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Reporting window">
        <P>
          The funnel detail page reports on the last 30 days. Historical figures are available over
          the <Link href="/docs/api" className="text-primary hover:underline">REST API</Link>.
        </P>
      </DocSection>
    </DocPage>
  );
}
