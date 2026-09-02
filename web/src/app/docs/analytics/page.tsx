import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Analytics · Seentics docs',
  description: 'Traffic, sources, devices, geography and realtime — what Seentics measures and how.',
};

export default function AnalyticsPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Analytics"
      lead="Everything on this page works from the script tag alone — there is nothing to configure."
    >
      <DocSection title="What is collected automatically">
        <P>
          With the tracker installed and no other setup, Seentics records pageviews — including
          client-side route changes in single-page apps — and page performance timings.
        </P>
        <RefTable
          columns={['Metric', 'What it means']}
          rows={[
            ['Unique visitors', 'Distinct visitor IDs in the period. The ID lives in localStorage, so a returning visitor is not counted twice.'],
            ['Total visits', 'Sessions. A session ends after a period of inactivity or a hard cap.'],
            ['Page views', 'Every pageview, including repeat views of the same page.'],
            ['Live visitors', 'Active in roughly the last 30 minutes.'],
            ['Session duration', 'Average time between a session’s first and last event.'],
            ['Bounce rate', 'Share of sessions with a single pageview.'],
          ]}
        />
      </DocSection>

      <DocSection title="Breakdowns">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Pages</strong> — most viewed, plus entry
            and exit pages, so you can see where sessions start and where they end.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Sources</strong> — referrers, and UTM
            source, medium and campaign when present.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Technology</strong> — device type,
            operating system, browser and screen resolution.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Geography</strong> — country, on a map
            and as a list.
          </Li>
        </Ul>
        <Callout kind="note" title="Geography without an IP address">
          Country is resolved at ingest and the IP is not stored with the event. There is no
          city-level or IP-level reporting, by design.
        </Callout>
      </DocSection>

      <DocSection title="Realtime">
        <P>
          <C>Realtime</C> shows the last ~30 minutes: a live visitor count, top pages and countries,
          and a running activity log of recent pageviews with visitor context. Useful for confirming
          a deploy or watching a launch.
        </P>
      </DocSection>

      <DocSection title="Custom events">
        <P>
          Anything beyond a pageview you send yourself. One call records the event, advances any
          matching funnel step, and can fire an automation.
        </P>
        <CodeBlock
          language="js"
          filename="checkout.js"
          code={`seentics.track('signup_complete', { plan: 'growth' });`}
        />
        <P>
          Events appear under <C>Custom Events</C>, where you can open one to see a breakdown by any
          property you attached. Internal tracker events — pageviews, scroll depth and the like — are
          filtered out of that list so it only shows what you sent.
        </P>
      </DocSection>

      <DocSection title="Goals">
        <P>
          A goal names a page or event that counts as success, so conversions get their own reporting
          rather than being buried in the event list. Define them in{' '}
          <C>Settings → Goals</C>.
        </P>
      </DocSection>

      <DocSection title="Asking questions in plain English">
        <P>
          Press <C>⌘K</C> on any dashboard page to ask Seentics AI about your data — &ldquo;top ten
          pages this week&rdquo;, &ldquo;which sources convert best&rdquo;. Answers come back as a
          table you can export as CSV.
        </P>
      </DocSection>

      <DocSection title="Reading the data yourself">
        <P>
          Everything here is available over the{' '}
          <Link href="/docs/api" className="text-primary hover:underline">REST API</Link> with an{' '}
          <Link href="/docs/api-keys" className="text-primary hover:underline">API key</Link>.
        </P>
      </DocSection>
    </DocPage>
  );
}
