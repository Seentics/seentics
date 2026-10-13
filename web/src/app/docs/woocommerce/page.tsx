import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'WooCommerce · Seentics docs',
  description: 'Track WooCommerce purchases, product views, add to cart and checkout in Seentics revenue reports and funnels.',
};

export default function WooCommercePage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="WooCommerce"
      lead="With the Seentics plugin active, your store's orders appear under Revenue, and shopping steps become events you can use in funnels."
    >
      <DocSection title="Set up">
        <Ol>
          <Oli>
            Install the plugin and save your website ID, as described in{' '}
            <Link href="/docs/wordpress" className="text-primary hover:underline">WordPress</Link>.
          </Oli>
          <Oli>Open <C>Settings → Seentics</C> and make sure <C>Report purchases, product views, add to cart and checkout</C> is ticked. It is on by default.</Oli>
          <Oli>Place a test order. Within a minute it appears in Seentics under <C>Revenue</C>.</Oli>
        </Ol>
      </DocSection>

      <DocSection title="What is reported">
        <RefTable
          columns={['Event', 'When', 'Properties']}
          rows={[
            [<C key="p">purchase</C>, 'The order confirmation page, for orders that are not failed or cancelled', <span key="pp"><C>value</C> (order total, tax and shipping included), <C>currency</C>, <C>order_id</C>, <C>product_name</C>, <C>user_type</C> (new or returning), <C>items</C></span>],
            [<C key="v">view_item</C>, 'A product page', <span key="vp"><C>item_id</C>, <C>product_name</C>, <C>sku</C>, <C>value</C>, <C>currency</C></span>],
            [<C key="a">add_to_cart</C>, 'A product is added to the cart', <span key="ap"><C>item_id</C>, <C>product_name</C>, <C>sku</C>, <C>value</C>, <C>currency</C>, <C>qty</C></span>],
            [<C key="b">begin_checkout</C>, 'The checkout page, when the cart is not empty', <span key="bp"><C>value</C>, <C>currency</C>, <C>qty</C></span>],
          ]}
        />
        <P>
          <C>purchase</C> is the event the <Link href="/docs/analytics" className="text-primary hover:underline">Revenue</Link>{' '}
          report is built from, with source and campaign attribution. The other three are ordinary
          custom events: use them as steps in a{' '}
          <Link href="/docs/funnels" className="text-primary hover:underline">funnel</Link>, for example{' '}
          <C>view_item → add_to_cart → begin_checkout → purchase</C>, to see where shoppers drop out.
        </P>
        <Ul>
          <Li><strong className="font-medium text-foreground">Reloads are safe.</strong> Seentics counts one order per <C>order_id</C>, so refreshing the confirmation page does not add revenue.</Li>
          <Li><strong className="font-medium text-foreground">Order number.</strong> <C>order_id</C> is the number your customers see, which may differ from the internal ID if you use a sequential-number plugin.</Li>
          <Li><strong className="font-medium text-foreground">Currency.</strong> The order&apos;s own currency. Seentics does not convert; totals are shown in the currency most orders use.</Li>
          <Li><strong className="font-medium text-foreground">Your own orders.</strong> Orders you place while logged in as an administrator are not counted unless you turn that on in the settings.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Limits">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Refunds are not reported yet.</strong> Revenue
            shows what customers paid, before refunds. To net a refund off, send it from your own code:{' '}
            <C>seentics.track(&apos;refund&apos;, {'{'} value, currency, order_id {'}'})</C>.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Add to cart from the block-based cart.</strong>{' '}
            Adds made without a page reload through the newer cart blocks may not be reported. Adds from
            product pages and shop-page buttons are.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Orders placed outside the storefront</strong>{' '}
            (admin-created orders, subscription renewals) are not seen: the purchase is sent from the
            customer&apos;s browser, after checkout.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Blocked trackers.</strong> Visitors with an ad
            blocker, or who decline tracking, are not counted, so Revenue can be lower than WooCommerce&apos;s own report.
          </Li>
        </Ul>
        <Callout kind="note" title="Guest order pages">
          WooCommerce only shows a guest&apos;s confirmation page for ten minutes after the order. A
          purchase is therefore reported when the customer lands on it, not when they open the link
          from the email later.
        </Callout>
      </DocSection>

      <DocSection title="Checking a store">
        <P>If purchases are missing, view the source of the order confirmation page and search for:</P>
        <CodeBlock filename="page source" language="js" code={`seenticsRun(function(s){s.track("purchase",{"value":58,"currency":"EUR","order_id":"11", …`} />
        <Ul>
          <Li>Not there: the WooCommerce option is off, the visitor is a logged-in administrator, or a theme replaced the confirmation page without the standard <C>woocommerce_thankyou</C> hook.</Li>
          <Li>There, but nothing in Revenue: the tracker did not load. Look for a blocked request in the browser&apos;s Network tab.</Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
