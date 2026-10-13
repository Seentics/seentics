import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Google Tag Manager · Seentics docs',
  description: 'Load Seentics from Google Tag Manager and send purchases from the GA4 ecommerce dataLayer.',
};

const LOADER = `<script>
(function () {
  if (document.getElementById('seentics-js')) return;
  var s = document.createElement('script');
  s.id = 'seentics-js';
  s.defer = true;
  s.src = 'https://seentics.com/trackers/seentics.min.js';
  s.setAttribute('data-website-id', 'YOUR_WEBSITE_ID');
  document.head.appendChild(s);
})();
</script>`;

const PURCHASE = `<script>
(function () {
  var e = {{DLV - ecommerce}} || {};
  var value = Number(e.value);
  if (!isFinite(value)) return;
  var items = (e.items || []).map(function (i) {
    return { name: i.item_name, sku: i.item_id, qty: i.quantity || 1, price: i.price };
  });
  var props = {
    value: value,
    currency: e.currency || 'USD',
    order_id: String(e.transaction_id || ''),
    product_name: items[0] ? items[0].name : '',
    items: items
  };
  var tries = 0;
  (function send() {
    if (window.seentics && window.seentics.track) {
      window.seentics.track('purchase', props);
    } else if (++tries < 100) {
      setTimeout(send, 100); // the tracker is deferred: wait for it
    }
  })();
})();
</script>`;

const PUSH = `window.dataLayer = window.dataLayer || [];
dataLayer.push({ ecommerce: null }); // clear the previous ecommerce object
dataLayer.push({
  event: 'purchase',
  ecommerce: {
    transaction_id: 'ORD-8821',
    value: 49.99,
    currency: 'USD',
    items: [{ item_name: 'T-shirt', item_id: 'TSHIRT-M', quantity: 2, price: 29.0 }]
  }
});`;

export default function GoogleTagManagerPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="Google Tag Manager"
      lead="Load the tracker with a Custom HTML tag, then turn your existing ecommerce dataLayer events into Seentics purchases."
    >
      <DocSection title="1. Load the tracker">
        <Ol>
          <Oli>In GTM: <C>Tags → New → Custom HTML</C>. Name it <C>Seentics tracker</C>.</Oli>
          <Oli>Paste the code below, replacing <C>YOUR_WEBSITE_ID</C> with the ID from <C>Settings → Tracking</C> in Seentics.</Oli>
          <Oli>Trigger: <C>Initialization – All Pages</C> (or <C>All Pages</C>). Save, preview, then publish the container.</Oli>
        </Ol>
        <CodeBlock filename="Custom HTML" language="html" code={LOADER} />
        <P>
          This creates the script element with JavaScript rather than pasting the plain tag. The tracker
          reads its own <C>&lt;script&gt;</C> element for its settings, and an element made this way is
          the one it finds. Use the plain tag only if you are sure your GTM setup leaves it as a normal
          script element. The tracker is <C>defer</C>red either way, so anything that calls it must wait
          for it, as the next step does.
        </P>
      </DocSection>

      <DocSection title="2. Send purchases from the GA4 dataLayer">
        <P>
          If your store already pushes the GA4 <C>purchase</C> event, you can reuse it. The push looks like
          this (your platform or its GTM plugin usually does it for you):
        </P>
        <CodeBlock filename="what the page pushes" language="js" code={PUSH} />
        <Ol>
          <Oli>Variables → New → <C>Data Layer Variable</C>. Name it <C>DLV - ecommerce</C>, Data Layer Variable Name <C>ecommerce</C>, version 2.</Oli>
          <Oli>Triggers → New → <C>Custom Event</C>, event name <C>purchase</C>. Name it <C>Event - purchase</C>.</Oli>
          <Oli>Tags → New → Custom HTML, named <C>Seentics purchase</C>, with the code below and the trigger <C>Event - purchase</C>.</Oli>
        </Ol>
        <CodeBlock filename="Custom HTML" language="html" code={PURCHASE} />
        <P>
          The mapping is: <C>transaction_id</C> → <C>order_id</C>, <C>value</C> and <C>currency</C> as they
          are, and each item&apos;s <C>item_name</C>, <C>item_id</C>, <C>quantity</C> and <C>price</C> →{' '}
          <C>name</C>, <C>sku</C>, <C>qty</C> and <C>price</C>. Seentics counts one order per <C>order_id</C>,
          so a reloaded confirmation page does not double the revenue. See{' '}
          <Link href="/docs/analytics" className="text-primary hover:underline">Revenue</Link> for every property.
        </P>
        <Callout kind="warning" title="Untested in a live container">
          This follows GTM&apos;s documented behaviour and the tracker&apos;s source, but has not been run against
          a live container. Use Preview mode and a test order, and confirm the order under Revenue.
        </Callout>
      </DocSection>

      <DocSection title="Consent">
        <P>
          Seentics does <strong>not</strong> read Google Consent Mode signals or the <C>dataLayer</C>. Its
          own consent handling is separate: by default a visitor in a region that requires consent is
          asked before recordings start, and you can pass your consent tool&apos;s answer in yourself.
        </P>
        <Ul>
          <Li>Fire the loader tag only after consent, using your consent tool&apos;s trigger, if you want nothing to load before it.</Li>
          <Li>Or load it always, and add a second Custom HTML tag, triggered when the visitor grants consent, that calls <C>seentics.consent(true)</C> (and <C>seentics.consent(false)</C> when they withdraw). The tracker remembers the answer.</Li>
          <Li>To skip the tracker&apos;s own consent card because you have a banner, add <C>s.setAttribute(&apos;data-consent-banner&apos;, &apos;off&apos;)</C> to the loader.</Li>
        </Ul>
        <P>
          Details are in the <Link href="/docs/tracker" className="text-primary hover:underline">tracker reference</Link>.
        </P>
      </DocSection>
    </DocPage>
  );
}
