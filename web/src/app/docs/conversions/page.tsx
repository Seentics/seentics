import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Conversions · Seentics docs',
  description: 'Send purchases, leads and sign-ups to Meta, Google Analytics 4, TikTok and LinkedIn from Seentics’ servers, matched and deduplicated, for consenting visitors only.',
};

export default function ConversionsDocsPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Conversions"
      lead="Your purchases, leads and sign-ups, sent from Seentics' servers to your ad platforms — so ad blockers and browser limits can't drop them."
    >
      <DocSection title="What it does">
        <P>
          Ad platforms learn which ads work from the conversions you report back. A browser pixel reports them from the
          visitor&apos;s browser, where ad blockers, Brave and Safari&apos;s tracking limits stop a share of them. Seentics
          already receives your conversions on its own servers, so it can send them on from there: a request between two
          servers that nothing in the browser can block.
        </P>
        <Ul>
          <Li><strong>Purchases</strong> — <C>seentics.track(&apos;purchase&apos;)</C> and the Shopify and WooCommerce plugins, with value, currency and order id.</Li>
          <Li><strong>Leads</strong> — popup and form submissions, when the visitor ticked the consent box.</Li>
          <Li><strong>Sign-ups</strong> — <C>seentics.track(&apos;sign_up&apos;)</C>.</Li>
          <Li><strong>Custom events</strong> — any event you track, mapped to a platform event (for example <C>checkout_started</C> → <C>InitiateCheckout</C>).</Li>
        </Ul>
        <P>Four platforms: Meta (Conversions API), Google Analytics 4 (Measurement Protocol), TikTok (Events API) and LinkedIn (Conversions API).</P>
      </DocSection>

      <DocSection title="Only visitors who consented">
        <P>
          Sending a visitor&apos;s data to an ad platform needs their consent. Seentics only sends conversions from visitors
          the tracker counts as consented — never from the anonymous visitors counted under a daily id — and sends a popup
          lead only when its consent box was ticked. Conversions that were not sent for this reason are simply not queued,
          so they do not appear in the events list.
        </P>
        <Callout kind="note" title="Where consent comes from">
          The same place as the rest of Seentics: your cookie banner calling <C>seentics.consent(true)</C>, or the
          site&apos;s consent mode. See <Link href="/docs/privacy" className="text-primary hover:underline">Privacy &amp; security</Link>.
        </Callout>
      </DocSection>

      <DocSection title="How a conversion is matched">
        <P>
          The platform has to work out who converted to credit the right ad. Each conversion carries whatever of these
          Seentics has; the Conversions page shows how many of yours carried each one.
        </P>
        <RefTable
          columns={['Key', 'Where it comes from', 'Notes']}
          rows={[
            ['Click ID', <>The <C>fbclid</C>, <C>gclid</C>, <C>ttclid</C> or <C>li_fat_id</C> on the ad link the visitor landed from</>, 'The strongest: it points at the exact click. Kept for the visit and sent with the conversion days later.'],
            ['Email', <>A lead&apos;s email, or <C>email</C> passed with the event</>, 'Hashed (SHA-256) on Seentics’ servers before it is sent. Never stored in analytics.'],
            ['Phone', 'A lead’s phone number', 'Hashed the same way. LinkedIn does not take it.'],
            ['IP + browser', 'The request the conversion arrived in', 'A weak hint, for Meta and TikTok; sent only to the platform, not kept.'],
            ['Browser ID', <>The <C>_fbp</C>, <C>_ga</C> or <C>_ttp</C> cookie, when the site also runs the Meta pixel, gtag or TikTok pixel; LinkedIn&apos;s <C>li_fat_id</C> cookie from the Insight Tag</>, 'Lets the platform join the server event to the browser’s own.'],
          ]}
        />
      </DocSection>

      <DocSection id="email" title="Send the buyer's email with a purchase">
        <P>
          A purchase without a click ID — someone who came back days later from a bookmark — can still be matched by email.
          Pass it with the event; Seentics hashes it before forwarding and keeps it out of your analytics.
        </P>
        <CodeBlock
          language="js"
          code={`seentics.track('purchase', {
  value: 49.99,
  currency: 'USD',
  order_id: 'ORD-1042',
  email: 'buyer@example.com', // hashed before it is sent, never stored in analytics
});`}
        />
      </DocSection>

      <DocSection title="Running a browser pixel as well">
        <P>
          Many sites keep the Meta pixel or gtag running alongside. To have each sale counted once, give both the same id:
          the order id.
        </P>
        <Ul>
          <Li>Meta: pass the order id as the pixel event&apos;s <C>eventID</C> — <C>fbq(&apos;track&apos;, &apos;Purchase&apos;, {'{ value, currency }'}, {'{ eventID: orderId }'})</C>. Seentics sends it as <C>event_id</C>.</Li>
          <Li>GA4: use the order id as <C>transaction_id</C>; GA4 deduplicates purchases on it.</Li>
          <Li>TikTok: pass the order id as the pixel event&apos;s <C>event_id</C> — <C>ttq.track(&apos;CompletePayment&apos;, {'{ value, currency }'}, {'{ event_id: orderId }'})</C>.</Li>
          <Li>LinkedIn: pass the order id as the Insight Tag&apos;s <C>event_id</C> — <C>window.lintrk(&apos;track&apos;, {'{ conversion_id: ruleId, event_id: orderId }'})</C>.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Connect Meta">
        <Ol>
          <Oli>In Meta Events Manager, open your pixel → <strong>Settings</strong> → <strong>Conversions API</strong> → <strong>Generate access token</strong>.</Oli>
          <Oli>In Seentics, open <strong>Conversions</strong> → <strong>Connect platform</strong> → <strong>Meta</strong>, and paste the Pixel ID and the token.</Oli>
          <Oli>Choose which events to send (the defaults are Purchase, Lead and CompleteRegistration) and connect. Seentics checks the token with Meta first.</Oli>
          <Oli>Use <strong>Send test event</strong> with a code from Events Manager → <strong>Test events</strong> to see one arrive.</Oli>
        </Ol>
      </DocSection>

      <DocSection title="Connect Google Analytics 4">
        <Ol>
          <Oli>In GA4, go to <strong>Admin</strong> → <strong>Data streams</strong> → your web stream → <strong>Measurement Protocol API secrets</strong> → <strong>Create</strong>.</Oli>
          <Oli>In Seentics, connect <strong>Google Analytics 4</strong> with the stream&apos;s Measurement ID (<C>G-…</C>) and the secret.</Oli>
          <Oli>Choose the events (purchase, generate_lead, sign_up by default). The test event is checked against Google&apos;s validation endpoint, so it adds nothing to your reports.</Oli>
        </Ol>
      </DocSection>

      <DocSection title="Connect TikTok">
        <Ol>
          <Oli>In TikTok Ads Manager, open <strong>Tools</strong> → <strong>Events</strong> → your web pixel → <strong>Settings</strong> → <strong>Events API</strong> → <strong>Generate access token</strong>.</Oli>
          <Oli>In Seentics, connect <strong>TikTok</strong> with the Pixel ID (letters and digits, like <C>C4ABCD1234EFGH5678</C>) and the token.</Oli>
          <Oli>Choose the events (CompletePayment, SubmitForm and CompleteRegistration by default). Send a test with a code from the pixel&apos;s <strong>Test events</strong> tab to see it arrive without it counting.</Oli>
        </Ol>
      </DocSection>

      <DocSection title="Connect LinkedIn">
        <P>
          LinkedIn counts each event toward a <em>conversion rule</em> rather than by name, so make one per event first.
          LinkedIn matches people by email and its own click id only: a conversion with neither is not sent.
        </P>
        <Ol>
          <Oli>In Campaign Manager, open <strong>Analyze</strong> → <strong>Conversion tracking</strong> → <strong>Create conversion</strong>, choose <strong>Conversions API</strong> as the source, and note each rule&apos;s ID.</Oli>
          <Oli>Create an access token with the <C>rw_conversions</C> scope, from a LinkedIn developer app that has the Conversions API product.</Oli>
          <Oli>In Seentics, connect <strong>LinkedIn</strong> with the ad account ID and the token, then enter the rule ID for each event you send.</Oli>
          <Oli>LinkedIn has no test mode, so <strong>Send test</strong> sends nothing: it checks the token and that every rule you mapped exists in the account.</Oli>
        </Ol>
      </DocSection>

      <DocSection title="Troubleshooting">
        <Ul>
          <Li><strong>A platform card says it needs attention.</strong> Its credentials stopped working — usually a revoked or expired token. Use <strong>Edit credentials</strong> with a new one; failed conversions can be retried from the events list.</Li>
          <Li><strong>Conversions show as failed.</strong> The error beside each one is the platform&apos;s own message. Each is retried for several hours before it is marked failed.</Li>
          <Li><strong>Fewer conversions than sales.</strong> Only consenting visitors are sent. Visitors who declined are counted in your dashboard but not forwarded.</Li>
          <Li><strong>Low match quality.</strong> Send the buyer&apos;s email with purchases, and keep ad links&apos; click IDs (do not strip <C>fbclid</C>, <C>gclid</C>, <C>ttclid</C> or <C>li_fat_id</C> in redirects).</Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
