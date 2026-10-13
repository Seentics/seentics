import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Frameworks · Seentics docs',
  description: 'Add Seentics to Next.js, React, Vue, Nuxt, Astro, SvelteKit, Remix, Gatsby or Angular.',
};

export default function FrameworksPage() {
  return (
    <DocPage
      eyebrow="Frameworks"
      title="Frameworks"
      lead="One component per framework loads the tracker once and gives you typed event helpers. Anything without a package takes the script tag."
    >
      <DocSection title="What the packages do">
        <P>
          Every framework package is a thin layer over <C>@seentics/browser</C>, which loads the same
          tracker file as the script tag. They exist to handle the parts that are awkward to do by hand:
        </P>
        <Ul>
          <Li>The script is added <strong className="font-medium text-foreground">once</strong>, even when a component mounts twice (React strict mode, hot reload, a layout that remounts).</Li>
          <Li>Nothing runs on the server. <C>track()</C> called while rendering on the server is ignored: there is no visitor yet.</Li>
          <Li>Events sent before the tracker has loaded are <strong className="font-medium text-foreground">queued and replayed in order</strong>, up to 200. If the tracker never arrives (an ad blocker), they are dropped quietly and never throw.</Li>
          <Li>A website ID that is not a UUID is refused with a console warning, instead of sending nothing silently.</Li>
        </Ul>
        <P>
          Get the website ID from <C>Settings → Tracking</C> in Seentics. All options are on the{' '}
          <Link href="/docs/tracker" className="text-primary hover:underline">tracker reference</Link>; each is
          a prop of the component: <C>websiteId</C> (required), <C>src</C>, <C>apiHost</C>, <C>autoTrack</C>,{' '}
          <C>consent</C>, <C>consentBanner</C>, <C>privacyUrl</C>, <C>captureConsole</C>, <C>captureNetwork</C>,{' '}
          <C>rrwebSrc</C> and <C>nonce</C>.
        </P>
        <Callout kind="note" title="Page changes are tracked for you">
          The tracker listens for <C>history.pushState</C>, <C>replaceState</C> and <C>popstate</C>, so
          client-side route changes in a single-page app produce a pageview without any router code. A
          navigation counts only when the <strong>path</strong> changes: a change to the query string or{' '}
          <C>#hash</C> alone does not. For a router that fakes pages with hashes, set{' '}
          <C>autoTrack: false</C> and call <C>page()</C> yourself.
        </Callout>
      </DocSection>

      <DocSection id="nextjs" title="Next.js">
        <CodeBlock filename="terminal" language="bash" code={`npm i @seentics/next`} />
        <P>App Router: put the component in the root layout. It works in a server component.</P>
        <CodeBlock
          filename="app/layout.tsx"
          language="tsx"
          code={`import { Seentics } from '@seentics/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Seentics websiteId="YOUR_WEBSITE_ID" />
        {children}
      </body>
    </html>
  );
}`}
        />
        <P>Pages Router: the same component in <C>pages/_app.tsx</C>.</P>
        <CodeBlock
          filename="pages/_app.tsx"
          language="tsx"
          code={`import type { AppProps } from 'next/app';
import { Seentics } from '@seentics/next';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Seentics websiteId="YOUR_WEBSITE_ID" />
      <Component {...pageProps} />
    </>
  );
}`}
        />
        <P>Send events from a client component or an event handler:</P>
        <CodeBlock
          filename="components/BuyButton.tsx"
          language="tsx"
          code={`'use client';
import { track } from '@seentics/next';

export function BuyButton() {
  return <button onClick={() => track('add_to_cart', { sku: 'TEE-1', value: 29 })}>Add to cart</button>;
}`}
        />
        <P>
          To serve the tracker from your own domain, see{' '}
          <Link href="/docs/proxy" className="text-primary hover:underline">Serve Seentics from your own domain</Link>.
        </P>
      </DocSection>

      <DocSection id="react" title="React (Vite, Create React App)">
        <CodeBlock filename="terminal" language="bash" code={`npm i @seentics/react`} />
        <CodeBlock
          filename="src/main.tsx"
          language="tsx"
          code={`import { Seentics } from '@seentics/react';

root.render(
  <>
    <Seentics websiteId="YOUR_WEBSITE_ID" />
    <App />
  </>,
);`}
        />
        <CodeBlock
          filename="src/Checkout.tsx"
          language="tsx"
          code={`import { useSeentics } from '@seentics/react';

export function Checkout({ order }: { order: { id: string; total: number } }) {
  const seentics = useSeentics();
  const onPaid = () => seentics.trackPurchase({ value: order.total, currency: 'USD', order_id: order.id });
  return <button onClick={onPaid}>Pay</button>;
}`}
        />
      </DocSection>

      <DocSection id="vue" title="Vue">
        <CodeBlock filename="terminal" language="bash" code={`npm i @seentics/vue`} />
        <CodeBlock
          filename="src/main.ts"
          language="ts"
          code={`import { createApp } from 'vue';
import { SeenticsPlugin } from '@seentics/vue';
import App from './App.vue';

createApp(App).use(SeenticsPlugin, { websiteId: 'YOUR_WEBSITE_ID' }).mount('#app');`}
        />
        <CodeBlock
          filename="any component"
          language="ts"
          code={`import { track } from '@seentics/vue';

track('signup', { plan: 'pro' });`}
        />
      </DocSection>

      <DocSection id="nuxt" title="Nuxt">
        <CodeBlock filename="terminal" language="bash" code={`npm i @seentics/nuxt`} />
        <CodeBlock
          filename="nuxt.config.ts"
          language="ts"
          code={`export default defineNuxtConfig({
  modules: ['@seentics/nuxt'],
  seentics: { websiteId: 'YOUR_WEBSITE_ID' },
});`}
        />
        <P>
          For events, import <C>track</C> from <C>@seentics/browser</C>, the package every other one is
          built on.
        </P>
      </DocSection>

      <DocSection id="astro" title="Astro">
        <CodeBlock filename="terminal" language="bash" code={`npm i @seentics/astro`} />
        <P>Either the integration, which adds the tracker to every page:</P>
        <CodeBlock
          filename="astro.config.mjs"
          language="js"
          code={`import { defineConfig } from 'astro/config';
import seentics from '@seentics/astro';

export default defineConfig({ integrations: [seentics({ websiteId: 'YOUR_WEBSITE_ID' })] });`}
        />
        <P>or the component, in your layout&apos;s <C>&lt;head&gt;</C>:</P>
        <CodeBlock
          filename="src/layouts/Base.astro"
          language="astro"
          code={`---
import Seentics from '@seentics/astro/Seentics.astro';
---
<head>
  <Seentics websiteId="YOUR_WEBSITE_ID" />
</head>`}
        />
        <P>
          Astro&apos;s view transitions swap pages with the History API, which the tracker follows. Send
          events from a client script with <C>track</C> from <C>@seentics/browser</C>.
        </P>
      </DocSection>

      <DocSection id="svelte" title="SvelteKit and Svelte">
        <CodeBlock filename="terminal" language="bash" code={`npm i @seentics/svelte`} />
        <CodeBlock
          filename="src/routes/+layout.svelte"
          language="svelte"
          code={`<script>
  import { Seentics } from '@seentics/svelte';
</script>

<Seentics websiteId="YOUR_WEBSITE_ID" />
<slot />`}
        />
        <CodeBlock
          filename="any component"
          language="ts"
          code={`import { track } from '@seentics/browser';

track('newsletter_signup');`}
        />
      </DocSection>

      <DocSection id="other" title="Remix, Gatsby, Angular and anything else">
        <P>
          Without a package, put the tag in the one file that renders the document&apos;s{' '}
          <C>&lt;head&gt;</C>. Replace <C>YOUR_WEBSITE_ID</C>:
        </P>
        <CodeBlock
          filename="the script tag"
          language="html"
          code={`<script defer data-website-id="YOUR_WEBSITE_ID" src="https://seentics.com/trackers/seentics.min.js"></script>`}
        />
        <Ul>
          <Li><strong className="font-medium text-foreground">Remix:</strong> <C>app/root.tsx</C>, inside <C>&lt;head&gt;</C> of the document component.</Li>
          <Li><strong className="font-medium text-foreground">Gatsby:</strong> <C>gatsby-ssr.js</C>, <C>onRenderBody</C>, passed to <C>setHeadComponents</C> as a <C>&lt;script defer … /&gt;</C> element.</Li>
          <Li><strong className="font-medium text-foreground">Angular:</strong> <C>src/index.html</C>.</Li>
          <Li><strong className="font-medium text-foreground">Eleventy, Hugo, Jekyll, plain HTML:</strong> the base layout.</Li>
        </Ul>
        <P>
          The tracker is <C>defer</C>red, so call <C>seentics.track()</C> only once it has loaded (from a
          click handler, say), or use <C>@seentics/browser</C> to queue calls for you:{' '}
          <C>import {'{'} track {'}'} from &apos;@seentics/browser&apos;</C>.
        </P>
      </DocSection>

      <DocSection title="If nothing shows up">
        <Ul>
          <Li>Search the page source (or the DOM) for <C>seentics-js</C>. Missing: the component is not rendered, or the website ID was refused. Look for <C>[Seentics] websiteId is missing</C> in the console.</Li>
          <Li>Present, but no pageview: check the Network tab for <C>/api/v1/tracker/collect</C>. A blocked request is an ad blocker or a content-security policy; add the tracker host to <C>script-src</C> and <C>connect-src</C>.</Li>
          <Li>A <C>403</C> from collect: the website&apos;s URL in Seentics does not match the host you are browsing. Seentics Cloud checks this in production, so <C>localhost</C> is refused there; test on your real domain or a staging domain registered as a website.</Li>
        </Ul>
        <P>
          Other platforms:{' '}
          <Link href="/docs/website-builders" className="text-primary hover:underline">website builders</Link>,{' '}
          <Link href="/docs/google-tag-manager" className="text-primary hover:underline">Google Tag Manager</Link>,{' '}
          <Link href="/docs/ecommerce-platforms" className="text-primary hover:underline">e-commerce platforms</Link>.
        </P>
      </DocSection>
    </DocPage>
  );
}
