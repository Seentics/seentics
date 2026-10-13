import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, Ul } from '@/components/docs/DocsKit';
import { SHOPIFY_PIXEL, SHOPIFY_THEME_SNIPPET } from './code';

export const metadata = {
  title: 'Shopify · Seentics docs',
  description: 'Add Seentics to a Shopify store: a theme snippet for the storefront and a custom pixel for checkout and purchases.',
};

export default function ShopifyPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="Shopify"
      lead="Two pastes: a script tag in your theme for the storefront, and a custom pixel for the shopping events and purchases."
    >
      <Callout kind="warning" title="Not yet verified on a live store">
        The WordPress plugin is tested; this setup is not, because it needs a Shopify store. Place a test
        order after installing and confirm it appears under Revenue. The two things most likely to need
        attention are listed under &quot;If purchases do not appear&quot;.
      </Callout>

      <DocSection title="1. The storefront">
        <Ol>
          <Oli>In Shopify admin: <C>Online Store → Themes → … → Edit code</C>.</Oli>
          <Oli>Open <C>layout/theme.liquid</C> and paste this just before <C>&lt;/head&gt;</C>, replacing <C>YOUR_WEBSITE_ID</C> with the ID from <C>Settings → Tracking</C> in Seentics.</Oli>
        </Ol>
        <CodeBlock filename="layout/theme.liquid" language="html" code={SHOPIFY_THEME_SNIPPET} />
        <P>
          This records pageviews, session recordings and heatmaps on the storefront. Checkout pages are
          not part of the theme, so they need step 2.
        </P>
      </DocSection>

      <DocSection title="2. Shopping events and purchases">
        <Ol>
          <Oli>In Shopify admin: <C>Settings → Customer events → Add custom pixel</C>. Name it <C>Seentics</C>.</Oli>
          <Oli>Paste the code below, replace <C>YOUR_WEBSITE_ID</C> and save.</Oli>
          <Oli>Click <C>Connect</C>.</Oli>
        </Ol>
        <CodeBlock filename="custom pixel" language="js" code={SHOPIFY_PIXEL} />
        <P>
          It sends <C>view_item</C>, <C>add_to_cart</C>, <C>begin_checkout</C> and <C>purchase</C>. The
          purchase carries the order total, currency, order ID and line items, and appears under{' '}
          <Link href="/docs/analytics" className="text-primary hover:underline">Revenue</Link>. The other
          three can be used as steps in a{' '}
          <Link href="/docs/funnels" className="text-primary hover:underline">funnel</Link>.
        </P>
      </DocSection>

      <DocSection title="3. Test it">
        <Ol>
          <Oli>Place a test order (Shopify&apos;s Bogus Gateway, or a 100% discount code).</Oli>
          <Oli>In Seentics, open <C>Revenue</C>. The order shows within a minute.</Oli>
        </Ol>
      </DocSection>

      <DocSection title="If purchases do not appear">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Domain mismatch.</strong> Seentics accepts
            events only from the website URL registered for the ID. Shopify runs pixels in a sandbox; if
            its address differs from your site&apos;s, the browser&apos;s Network tab shows a{' '}
            <C>403</C> from <C>/collect</C>. Check that the URL on the website in Seentics is your shop&apos;s
            public domain, not the <C>myshopify.com</C> address, and write to support if it still fails.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Attribution.</strong> The pixel is a separate
            visitor from the theme&apos;s tracker, so a purchase may be credited to &quot;direct&quot;
            instead of the campaign that brought the shopper. The total is still right.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Nothing at all.</strong> Confirm the pixel is{' '}
            <C>Connected</C> and the website ID is correct. Shopify&apos;s customer-events screen has a
            Test mode that shows each event as it fires.
          </Li>
        </Ul>
        <P>Refunds are not reported; send them with <C>seentics.track(&apos;refund&apos;, …)</C> from your own code if you need revenue net of them.</P>
      </DocSection>
    </DocPage>
  );
}
