import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';
import { A, B } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Install & verify a client site · Seentics docs',
  description:
    'Get a client website’s Seentics snippet from the agency workspace, install it on any platform, and check that events are arriving.',
};

export default function AgencyInstallPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Install & verify"
      lead="Every website gets its own snippet. Put it on the site, then let the workspace confirm that events are arriving."
    >
      <DocSection title="Get the snippet">
        <Ul>
          <Li>
            When you add a website, its snippet appears straight away.
          </Li>
          <Li>
            Later, choose <B>Install</B> next to the site on its client&apos;s page, or{' '}
            <B>Install &amp; embed</B> in the site&apos;s menu on the <B>Websites</B> page.
          </Li>
        </Ul>
        <P>The snippet is one script tag with the website&apos;s ID:</P>
        <CodeBlock
          language="html"
          filename="index.html"
          code={`<script defer data-website-id="YOUR_WEBSITE_ID" src="https://seentics.com/trackers/seentics.min.js"></script>`}
        />
        <P>
          Copy it from the workspace rather than typing it — the ID is filled in for you.
        </P>
      </DocSection>

      <DocSection title="Install it">
        <P>
          The install panel has short steps for each platform. The full guides are here:
        </P>
        <RefTable
          columns={['Platform', 'What to do', 'Guide']}
          rows={[
            ['HTML', <>Paste the tag into the <C>&lt;head&gt;</C> of every page.</>, <A key="h" href="/docs/tracker">Tracker script</A>],
            ['Google Tag Manager', 'A Custom HTML tag with the snippet, fired on All Pages, then publish.', <A key="g" href="/docs/google-tag-manager">Google Tag Manager</A>],
            ['Next.js', <>Install <C>@seentics/next</C> and render it in the root layout.</>, <A key="n" href="/docs/frameworks">Frameworks</A>],
            ['WordPress', 'Install the Seentics plugin and paste the website ID.', <A key="w" href="/docs/wordpress">WordPress</A>],
            ['Shopify', <>The snippet in <C>theme.liquid</C>, plus the custom pixel for purchases.</>, <A key="s" href="/docs/shopify">Shopify</A>],
            ['npm', 'The React, Vue, Nuxt, Astro or Svelte package, with the website ID.', <A key="p" href="/docs/frameworks">Frameworks</A>],
          ]}
        />
        <P>
          Webflow, Wix, Squarespace, Framer and Ghost: see{' '}
          <A href="/docs/website-builders">Website builders</A>.
        </P>
      </DocSection>

      <DocSection title="Verify it">
        <P>
          Open the site in a browser so it sends a first event, then choose <B>Verify installation</B>{' '}
          in the install panel. It shows one of three states:
        </P>
        <RefTable
          columns={['State', 'Means', 'What to do']}
          rows={[
            [<B key="r">Receiving events</B>, 'Events arrived in the last 24 hours.', 'Nothing — tracking works. The panel shows when the last event came and how many arrived in 24 hours.'],
            [<B key="n">No events yet</B>, 'The site has never sent an event.', 'Install the snippet, open the site in a browser, then verify again.'],
            [<B key="s">Stopped</B>, 'Events used to arrive, but none in the last 24 hours.', 'Check the snippet is still on the site — a theme change or a new site build often removes it.'],
          ]}
        />
        <P>
          In the API these are <C>receiving</C>, <C>not_seen</C> and <C>stale</C>. On the client&apos;s page
          each website shows <B>Verified</B> once it has ever sent an event, or <B>Not installed</B>.
        </P>
      </DocSection>

      <DocSection title="If no events arrive">
        <Ul>
          <Li>
            Open the site, then the browser console. A message starting <C>[Seentics]</C> says what is
            wrong.
          </Li>
          <Li>
            The attribute is <C>data-website-id</C>, not <C>data-site-id</C>.
          </Li>
          <Li>
            The site must be served from the address you entered for the website — data from another
            hostname is refused.
          </Li>
          <Li>
            Ad blockers can stop the script. Test in a private window with extensions off, or serve the
            tracker from the client&apos;s own domain — see <A href="/docs/proxy">Your own domain</A>.
          </Li>
          <Li>
            An archived client&apos;s websites don&apos;t collect. Unarchive it first.
          </Li>
        </Ul>
        <Callout kind="tip" title="From your own code">
          <C>GET /api/v1/agency/websites/:id/install</C> returns the snippet, the platform steps and the
          tracking state, and <C>POST …/verify</C> checks again. See the{' '}
          <A href="/docs/agency/api/reference#get-install">API reference</A>.
        </Callout>
      </DocSection>
    </DocPage>
  );
}
