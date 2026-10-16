import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Website builders · Seentics docs',
  description: 'Add Seentics to Webflow, Wix, Squarespace, Framer and Ghost with the custom-code box.',
};

const TAG = `<script defer data-website-id="YOUR_WEBSITE_ID" src="https://seentics.com/trackers/seentics.min.js"></script>`;

const PURCHASE = `<script>
// Put on the order confirmation page, after the order's values are filled in.
(function () {
  var order = { id: 'ORDER_ID', total: 'ORDER_TOTAL', currency: 'USD' }; // replace with your builder's placeholders
  var value = Number(order.total);
  if (!isFinite(value) || value <= 0) return; // never send a placeholder that did not fill in
  var tries = 0;
  (function send() {
    if (window.seentics && window.seentics.track) {
      window.seentics.track('purchase', { value: value, currency: order.currency, order_id: String(order.id) });
    } else if (++tries < 100) {
      setTimeout(send, 100); // the tracker is deferred: wait for it
    }
  })();
})();
</script>`;

export default function WebsiteBuildersPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="Website builders"
      lead="Webflow, Wix, Squarespace, Framer and Ghost all have a custom-code box for the page header. The same one-line tag goes in each."
    >
      <DocSection title="The tag">
        <P>
          Replace <C>YOUR_WEBSITE_ID</C> with the ID from <C>Settings → Tracking</C> in Seentics. Put it in
          the site-wide <strong>header</strong> (<C>&lt;head&gt;</C>) custom code, so it loads on every page.
        </P>
        <CodeBlock filename="header code" language="html" code={TAG} />
        <Callout kind="note" title="Menu names change">
          Builders rename and move these settings, and some limit custom code to paid plans. The paths
          below are where each one has put it; if yours differs, look for &quot;custom code&quot;, &quot;code
          injection&quot; or &quot;header&quot; in the site settings.
        </Callout>
      </DocSection>

      <DocSection id="webflow" title="Webflow">
        <Ul>
          <Li>Site settings → <C>Custom code</C> → <C>Head code</C>. Paste the tag, save, then <strong className="font-medium text-foreground">publish</strong> the site: custom code does not run in the Designer or preview.</Li>
          <Li>Site-wide custom code can require a paid site plan.</Li>
          <Li>We are not aware of a documented way to read an order&apos;s total from page script on a Webflow Ecommerce confirmation page, so purchases are not covered here. Pageviews, recordings and heatmaps work as usual.</Li>
        </Ul>
      </DocSection>

      <DocSection id="wix" title="Wix">
        <Ul>
          <Li>Settings → <C>Custom code</C> (under Advanced) → <C>Add custom code</C>. Paste the tag, apply it to <strong className="font-medium text-foreground">All pages</strong>, place it in <strong className="font-medium text-foreground">Head</strong>, load once.</Li>
          <Li>Custom code in Wix can require a premium plan and a connected domain.</Li>
        </Ul>
      </DocSection>

      <DocSection id="squarespace" title="Squarespace">
        <Ul>
          <Li>Settings → Developer tools (or Advanced) → <C>Code injection</C> → <C>Header</C>. Paste the tag and save.</Li>
          <Li>Code injection can be limited to higher plans.</Li>
          <Li>
            Squarespace Commerce has a separate <C>Order confirmation page</C> injection box that can
            insert order values with placeholders. If your plan has it, use the purchase snippet below
            and fill the placeholders with the ones Squarespace documents for that box.
          </Li>
        </Ul>
      </DocSection>

      <DocSection id="framer" title="Framer">
        <Ul>
          <Li>Site settings → General → <C>Custom code</C> → <C>Start of &lt;head&gt; tag</C> (or end of head). Paste the tag and publish.</Li>
          <Li>Framer swaps pages without reloading; the tracker follows the browser&apos;s History API, so each page counts.</Li>
        </Ul>
      </DocSection>

      <DocSection id="ghost" title="Ghost">
        <Ul>
          <Li>Settings → <C>Code injection</C> → <C>Site header</C>. Paste the tag and save.</Li>
          <Li>Code injected there applies to every page of the site.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Check it works">
        <Ul>
          <Li>Publish, then open your live site in a private window. In Seentics, the Overview&apos;s Live visitors should include you within seconds.</Li>
          <Li>Nothing? View the page source and search for <C>seentics.min.js</C>. If it is missing, the site was not republished, or the plan does not allow custom code.</Li>
          <Li>Present but no data: see the checks in <Link href="/docs/quick-start" className="text-primary hover:underline">Quick start</Link>. A <C>403</C> on <C>/collect</C> means the website&apos;s URL in Seentics does not match your domain.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Purchases">
        <P>
          Where a builder lets you add code to its order confirmation page and fill in the order&apos;s
          total, send one <C>purchase</C> event. This snippet waits for the deferred tracker, and skips
          the call if the total did not turn into a number, so a placeholder that never filled in does
          not record a bogus order.
        </P>
        <CodeBlock filename="order confirmation page" language="html" code={PURCHASE} />
        <P>
          Replace <C>ORDER_ID</C> and <C>ORDER_TOTAL</C> with the builder&apos;s placeholders, and the
          currency. Properties are described in{' '}
          <Link href="/docs/analytics" className="text-primary hover:underline">Revenue</Link>. This snippet has not
          been tested on these builders: place a test order and confirm it under Revenue.
        </P>
      </DocSection>
    </DocPage>
  );
}
