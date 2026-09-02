import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Quick start · Seentics docs',
  description: 'Add the Seentics tracker to your site with one script tag and see your first visitors.',
};

/**
 * Rewritten against `public/trackers/seentics.js` rather than edited.
 *
 * The previous version documented `data-site-id`. The tracker reads
 * `data-website-id` (seentics.js line 14), so anyone who copied the snippet from
 * these docs installed a tracker that logged
 * "[Seentics] data-website-id is missing or empty" and sent nothing.
 */
export default function QuickStartPage() {
  return (
    <DocPage
      eyebrow="Getting started"
      title="Quick start"
      lead="One script tag in your <head>. Analytics, funnels, heatmaps and automations all start from it."
    >
      <DocSection title="1. Create a website">
        <P>
          Sign in and add the site you want to track. Seentics gives it a website ID — a UUID that
          identifies it on every request. You can copy it any time from{' '}
          <C>Settings → Tracking</C>.
        </P>
      </DocSection>

      <DocSection title="2. Add the script">
        <P>
          Paste this into your <C>&lt;head&gt;</C>, replacing <C>YOUR_WEBSITE_ID</C> with the ID from
          step 1. That is the whole install — there is no npm package to add and no build step.
        </P>
        <CodeBlock
          filename="index.html"
          language="html"
          code={`<!-- Seentics Analytics -->
<script
  defer
  data-website-id="YOUR_WEBSITE_ID"
  src="https://app.seentics.com/trackers/seentics.min.js"
></script>`}
        />
        <Callout kind="warning" title="The attribute is data-website-id">
          Not <C>data-site-id</C>. If it is missing or misspelled the tracker logs{' '}
          <C>[Seentics] data-website-id is missing or empty</C> to the console and sends nothing —
          check there first if no data arrives.
        </Callout>
      </DocSection>

      <DocSection title="3. Confirm it is working">
        <P>
          Load a page on your site, then open <C>Realtime</C> in the dashboard. Your own visit should
          appear within a few seconds. If it does not:
        </P>
        <Ul>
          <Li>Check the browser console for a message beginning <C>[Seentics]</C>.</Li>
          <Li>
            Check the Network tab for a request to <C>/api/v1/tracker/collect</C>. A blocked request
            usually means an ad blocker or a content-security policy.
          </Li>
          <Li>
            Confirm the website ID matches the site you are looking at — events for an unknown ID are
            discarded.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="What you get without any more work">
        <P>
          With the tag in place and nothing else configured, Seentics records pageviews (including
          history changes in single-page apps) and page performance timings. Everything else is opt-in
          from the dashboard.
        </P>
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Analytics</strong> — traffic, sources,
            devices, browsers and geography. On by default.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Session replays and heatmaps</strong> —
            enable per site in settings. The recorder is a separate 56&nbsp;KB file that only
            downloads once recording is on.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Funnels and automations</strong> — define
            them in the dashboard; the tracker already evaluates them.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Sending your own events">
        <P>
          Anything you send with <C>seentics.track()</C> becomes a custom event, can be used as a
          funnel step, and can fire an automation — all from the one call.
        </P>
        <CodeBlock
          filename="checkout.js"
          language="js"
          code={`seentics.track('add_to_cart', {
  sku: 'TRAILHEAD-32L',
  value: 168,
});`}
        />
        <P>
          See the <Link href="/docs/tracker" className="text-primary hover:underline">tracker
          reference</Link> for the full browser API and every script attribute.
        </P>
      </DocSection>
    </DocPage>
  );
}
