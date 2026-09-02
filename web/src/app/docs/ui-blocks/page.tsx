import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'UI blocks · Seentics docs',
  description: 'React components for putting Seentics charts into your own app.',
};

/**
 * Rewritten because the previous version could not work.
 *
 * It told readers to run `npm install @seentics/ui-blocks` and import
 * `AnalyticsWidget`. The package in this repo is named `@seentics/ui`, it is at
 * 0.1.0 and is not published to npm (the registry returns 404), and it exports no
 * `AnalyticsWidget`. The landing page's SDK section cites a third name,
 * `@seentics/react`, which does not exist either.
 *
 * So this page documents the real export list and is explicit that the package is
 * not on npm yet, rather than handing out an install command that fails.
 */
export default function UiBlocksPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="UI blocks"
      lead="React components that render your Seentics data inside your own app."
    >
      <Callout kind="warning" title="Not published to npm yet">
        <p>
          <C>@seentics/ui</C> lives in the Seentics repository under <C>ui/blocks</C> at version
          0.1.0 and is <strong className="font-medium text-foreground">not on the npm registry</strong>.
          Until it is published, use it from source — an <C>npm install</C> will fail.
        </p>
        <p className="mt-2">
          Earlier docs referred to <C>@seentics/ui-blocks</C> and the landing page to{' '}
          <C>@seentics/react</C>. Neither name has ever existed.
        </p>
      </Callout>

      <DocSection title="Using it from source">
        <P>
          Clone the repository and point your package manager at the workspace folder, or build it
          and install the tarball.
        </P>
        <CodeBlock
          language="bash"
          code={`git clone https://github.com/Seentics/seentics.git
cd seentics/ui/blocks
npm install
npm run build

# then, from your own project:
npm install /path/to/seentics/ui/blocks`}
        />
      </DocSection>

      <DocSection title="Components">
        <P>
          The full export list. <C>SeenticsProvider</C> supplies the website ID and API key to
          everything below it; <C>useSeentics</C> exposes the same context if you would rather
          render your own charts.
        </P>
        <RefTable
          columns={['Export', 'Renders']}
          rows={[
            [<C>SeenticsProvider</C>, 'Context. Wrap your app or the subtree that uses the blocks.'],
            [<C>useSeentics</C>, 'Hook for the provider’s context — build your own visuals on the same data.'],
            [<C>AnalyticsSummary</C>, 'The headline metrics row.'],
            [<C>TrafficChart</C>, 'Visitors and pageviews over time.'],
            [<C>TopPages</C>, 'Most-viewed pages.'],
            [<C>TopSources</C>, 'Referrers and campaigns.'],
            [<C>GoalConversions</C>, 'Goal completions.'],
            [<C>FunnelChart</C>, 'A funnel and its step drop-off.'],
            [<C>RealtimeCounter</C>, 'Live visitor count.'],
            [<C>HeatmapViewer</C>, 'A click or scroll map for a page.'],
            [<C>SessionReplayPlayer</C>, 'The replay player.'],
          ]}
        />
      </DocSection>

      <DocSection title="Example">
        <CodeBlock
          language="tsx"
          filename="Dashboard.tsx"
          code={`import {
  SeenticsProvider,
  AnalyticsSummary,
  TrafficChart,
  RealtimeCounter,
} from '@seentics/ui';

export function Dashboard() {
  return (
    <SeenticsProvider
      websiteId="YOUR_WEBSITE_ID"
      apiKey={process.env.SEENTICS_API_KEY!}
      apiHost="https://app.seentics.com"
    >
      <RealtimeCounter />
      <AnalyticsSummary />
      <TrafficChart granularity="daily" />
    </SeenticsProvider>
  );
}`}
        />
        <Callout kind="warning" title="Keep the key server-side">
          These components read the REST API, so they need a key. A key in client-side JavaScript is
          readable by anyone — proxy the requests through your own backend, or restrict the key to
          the narrowest scopes it needs. See{' '}
          <Link href="/docs/api-keys" className="text-primary hover:underline">API keys</Link>.
        </Callout>
      </DocSection>

      <DocSection title="If you would rather not use the package">
        <Ul>
          <Li>
            Read the <Link href="/docs/api" className="text-primary hover:underline">REST API</Link>{' '}
            and render with your own chart library.
          </Li>
          <Li>
            Share a dashboard read-only with a public link, from the site&apos;s settings — no code
            at all.
          </Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
