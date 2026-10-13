import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'BigCommerce, PrestaShop and Magento · Seentics docs',
  description: 'Add Seentics to BigCommerce, PrestaShop and Magento / Adobe Commerce, and report purchases from the order confirmation page.',
};

const TAG = `<script defer data-website-id="YOUR_WEBSITE_ID" src="https://seentics.com/trackers/seentics.min.js"></script>`;

const PRESTA = `{* themes/<your-theme>/templates/checkout/order-confirmation.tpl, inside the page's content block *}
{if isset($order) && $order.totals.total.amount > 0}
<script>
(function () {
  var props = {
    value: {$order.totals.total.amount|floatval},
    currency: '{$currency.iso_code|escape:'javascript':'UTF-8'}',
    order_id: '{$order.details.reference|escape:'javascript':'UTF-8'}'
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
</script>
{/if}`;

const BIGCOMMERCE = `<script>
// Storefront → Script Manager → new script, location: Footer, pages: Order confirmation.
(function () {
  var orderId = new URLSearchParams(location.search).get('orderId'); // adjust to how your confirmation URL carries the order id
  if (!orderId) return;
  fetch('/api/storefront/order/' + encodeURIComponent(orderId), { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (o) {
      if (!o || !isFinite(Number(o.orderAmount))) return;
      var tries = 0;
      (function send() {
        if (window.seentics && window.seentics.track) {
          window.seentics.track('purchase', {
            value: Number(o.orderAmount),
            currency: (o.currency && o.currency.code) || 'USD',
            order_id: String(o.orderId || orderId),
            items: ((o.lineItems && o.lineItems.physicalItems) || []).map(function (i) {
              return { name: i.name, sku: i.sku, qty: i.quantity, price: i.salePrice };
            })
          });
        } else if (++tries < 100) {
          setTimeout(send, 100);
        }
      })();
    })
    .catch(function () {});
})();
</script>`;

export default function EcommercePlatformsPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="BigCommerce, PrestaShop and Magento"
      lead="Put the tag in the storefront header, then send a purchase from the order confirmation page."
    >
      <Callout kind="warning" title="Written from the platforms' documentation, not run on a store">
        The script placement is routine. The purchase snippets read each platform&apos;s order data and
        have not been tested on a live shop, so a field name can differ in your version or theme. Place
        a test order and confirm it under{' '}
        <Link href="/docs/analytics" className="text-primary hover:underline">Revenue</Link> before relying on it.
      </Callout>

      <DocSection title="The tag, on every page">
        <P>Replace <C>YOUR_WEBSITE_ID</C> with the ID from <C>Settings → Tracking</C> in Seentics.</P>
        <CodeBlock filename="header" language="html" code={TAG} />
      </DocSection>

      <DocSection id="bigcommerce" title="BigCommerce">
        <Ul>
          <Li><strong className="font-medium text-foreground">Tag:</strong> Storefront → <C>Script Manager</C> → Create a script. Location <C>Header</C>, pages <C>All pages</C>, script type <C>Script</C>. Paste the tag.</Li>
          <Li><strong className="font-medium text-foreground">Purchase:</strong> a second script, location <C>Footer</C>, page <C>Order confirmation</C>. BigCommerce exposes the order through its Storefront API; the snippet below fetches it. How the order id reaches the confirmation page differs between checkout versions, so the first line is the part you will need to adjust.</Li>
        </Ul>
        <CodeBlock filename="Script Manager, order confirmation" language="html" code={BIGCOMMERCE} />
      </DocSection>

      <DocSection id="prestashop" title="PrestaShop">
        <Ul>
          <Li><strong className="font-medium text-foreground">Tag:</strong> put it in your theme&apos;s <C>head.tpl</C> (child theme recommended), or use a custom-code or header-scripts module from your back office.</Li>
          <Li><strong className="font-medium text-foreground">Purchase:</strong> the order confirmation page template receives an <C>$order</C> array. Add this to your theme&apos;s <C>order-confirmation.tpl</C>. The <C>amount</C> field is the order total as a number in PrestaShop 1.7 and later; check yours.</Li>
        </Ul>
        <CodeBlock filename="order-confirmation.tpl" language="html" code={PRESTA} />
      </DocSection>

      <DocSection id="magento" title="Magento / Adobe Commerce">
        <Ul>
          <Li><strong className="font-medium text-foreground">Tag:</strong> Admin → Content → Design → Configuration → edit the scope → <C>HTML Head</C> → <C>Scripts and Style Sheets</C>. Paste the tag and save; clear the cache.</Li>
          <Li>
            <strong className="font-medium text-foreground">Purchase:</strong> the order total is not available to the
            page without a PHP block or view model on the <C>checkout_onepage_success</C> page, and no
            snippet is offered here because it is untested. If your store already pushes the GA4{' '}
            <C>purchase</C> event to <C>dataLayer</C> (most analytics extensions do), use the{' '}
            <Link href="/docs/google-tag-manager" className="text-primary hover:underline">Google Tag Manager</Link>{' '}
            setup, which reads exactly that.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="What a purchase carries">
        <P>
          <C>value</C> (the order total as a number), <C>currency</C>, <C>order_id</C> and, optionally,{' '}
          <C>items</C> as <C>[{'{'} name, sku, qty, price {'}'}]</C> where <C>price</C> is the unit price.
          Seentics counts one order per <C>order_id</C>, so reloading the confirmation page does not add
          revenue twice. Refunds are sent separately with <C>refund</C>.
        </P>
      </DocSection>
    </DocPage>
  );
}
