import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Serve Seentics from your own domain · Seentics docs',
  description: 'Serve the Seentics tracker from your own domain on Next.js, Vercel, Netlify, Cloudflare or nginx, and what that does to visitor location.',
};

export default function ProxyPage() {
  return (
    <DocPage
      eyebrow="Frameworks"
      title="Serve Seentics from your own domain"
      lead="Load the tracker from a path on your site instead of seentics.com. Pick the mode that fits: serving the script is safe; sending events through your domain has a cost."
    >
      <DocSection title="Why">
        <P>
          Some privacy extensions and filter lists block requests to analytics hosts by name. A script
          loaded from <C>yoursite.com/_seentics/…</C> is a same-site request and is not matched by host.
          It also keeps the page&apos;s requests on your own origin, which helps with strict
          content-security policies.
        </P>
        <Callout kind="warning" title="Read the location caveat before proxying events">
          Choose <strong>Mode A</strong> unless you host Seentics yourself. Mode B hides your visitors&apos;
          addresses from Seentics Cloud, which breaks country and city reports and the consent region
          check. Details below.
        </Callout>
      </DocSection>

      <DocSection title="How the tracker finds its files">
        <P>
          The tracker reads its own <C>&lt;script&gt;</C> element. Everything else is derived from it,
          and each part can be overridden:
        </P>
        <Ul>
          <Li><strong className="font-medium text-foreground">Extension files</strong> (heatmaps, automations, replay, the DOM recorder) are fetched from the same folder as the script, by replacing the file name in <C>src</C>. They are content-hashed, so proxy the whole folder, not just <C>seentics.min.js</C>.</Li>
          <Li><strong className="font-medium text-foreground">Events and configuration</strong> go to <C>data-api-host</C> plus <C>/api/v1/tracker/…</C>. When <C>data-api-host</C> is not set, the host is the origin of the script. The exception is <C>seentics.com</C>, whose scripts always send to <C>https://api.seentics.com</C>.</Li>
          <Li>So when you serve the script from your own domain without setting <C>data-api-host</C>, events are sent to <strong>your</strong> domain at <C>/api/v1/tracker/collect</C>. Set <C>data-api-host</C> (the <C>apiHost</C> option in the framework packages) to keep sending events straight to Seentics.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Mode A: serve only the script (recommended)">
        <P>
          Proxy the <C>/trackers/</C> folder from <C>https://seentics.com</C> to a path on your
          site, and set <C>apiHost</C> to <C>https://api.seentics.com</C>. Events still go to Seentics
          from the visitor&apos;s browser, so the visitor&apos;s real address, location and consent region
          are intact. The script itself is no longer a third-party request.
        </P>
        <CodeBlock
          filename="the tag"
          language="html"
          code={`<script defer
  data-website-id="YOUR_WEBSITE_ID"
  data-api-host="https://api.seentics.com"
  src="/_seentics/trackers/seentics.min.js"></script>`}
        />
        <P>
          This does not hide the events request from a blocker that matches <C>api.seentics.com</C>.
          That is what Mode B is for.
        </P>
      </DocSection>

      <DocSection title="Mode B: send events through your domain">
        <P>
          Also proxy <C>/api/v1/</C>, and set <C>data-api-host</C> to your site plus the same prefix
          (<C>https://yoursite.com/_seentics</C>). Left unset, the tracker would use your site&apos;s root
          and miss the proxy. Nothing then leaves your origin.
        </P>
        <Callout kind="warning" title="What this does to location, on Seentics Cloud">
          <P>
            Seentics reads the visitor&apos;s address from a header set by the network in front of it.
            When the request comes from your Vercel, Netlify or Cloudflare proxy, the address Seentics
            sees is the <strong>proxy&apos;s</strong>, not the visitor&apos;s. There is no way for a third-party
            proxy to tell Seentics Cloud the real address: Seentics only accepts one from its own
            dashboards, authenticated with a secret.
          </P>
          <P>
            The tracker&apos;s source records the same problem: when its own dashboard forwarded events
            through a Cloudflare Pages Function, every visitor was located at one US address, EU
            visitors were recorded without the consent that the consent-region check asks for, and
            every country, region and city report was wrong. Expect the same from any proxy. This has not
            been measured for each host.
          </P>
        </Callout>
        <P>
          If you host Seentics yourself, this is not a problem as long as your proxy forwards the
          visitor&apos;s address and the server is configured to trust it (<C>TRUST_PROXY=true</C> and the
          header your proxy sets in <C>CLIENT_IP_HEADER</C>; see the deployment guide).
        </P>
        <Ul>
          <Li><strong className="font-medium text-foreground">Origin check.</strong> Seentics refuses events whose <C>Origin</C> (or, if absent, <C>Referer</C>) host differs from the website&apos;s registered URL (<C>www.</C> is ignored). A browser sends your site as the origin, and a rewrite that forwards headers keeps it. If a proxy replaces the header you will see <C>403 domain mismatch</C> on <C>/collect</C>. Header forwarding has not been verified on each platform below; test with a real visit.</Li>
          <Li><strong className="font-medium text-foreground">Path clashes.</strong> Proxying <C>/api/v1/</C> at your site root would shadow your own API under that path. Use a prefix such as <C>/_seentics/</C> (below), with <C>data-api-host</C> set to your site plus that prefix.</Li>
        </Ul>
      </DocSection>

      <DocSection title="Configs">
        <P>
          Each example serves the script folder under <C>/_seentics/trackers/</C> (Mode A). The lines
          marked <em>Mode B</em> add the API.
        </P>

        <h3 className="text-base font-semibold text-foreground">Next.js</h3>
        <CodeBlock
          filename="next.config.js"
          language="js"
          code={`const { withSeentics } = require('@seentics/next');

module.exports = withSeentics({}, { path: '/_seentics' });`}
        />
        <P>
          <C>withSeentics</C> adds the rewrites; <C>proxiedProps()</C> gives the matching component props
          (<C>src</C> and <C>apiHost</C>). If you prefer to write the rewrites yourself:
        </P>
        <CodeBlock
          filename="next.config.js"
          language="js"
          code={`module.exports = {
  async rewrites() {
    return [
      { source: '/_seentics/trackers/:path*', destination: 'https://seentics.com/trackers/:path*' },
      // Mode B only:
      // { source: '/_seentics/api/v1/:path*', destination: 'https://api.seentics.com/api/v1/:path*' },
    ];
  },
};`}
        />

        <h3 id="vercel" className="scroll-mt-24 text-base font-semibold text-foreground">Vercel (any framework)</h3>
        <CodeBlock
          filename="vercel.json"
          language="json"
          code={`{
  "rewrites": [
    { "source": "/_seentics/trackers/:path*", "destination": "https://seentics.com/trackers/:path*" }
  ]
}`}
        />
        <P>Mode B: add <C>{'{ "source": "/_seentics/api/v1/:path*", "destination": "https://api.seentics.com/api/v1/:path*" }'}</C>.</P>

        <h3 id="netlify" className="scroll-mt-24 text-base font-semibold text-foreground">Netlify</h3>
        <CodeBlock
          filename="netlify.toml"
          language="toml"
          code={`[[redirects]]
  from = "/_seentics/trackers/*"
  to = "https://seentics.com/trackers/:splat"
  status = 200
  force = true

# Mode B only:
# [[redirects]]
#   from = "/_seentics/api/v1/*"
#   to = "https://api.seentics.com/api/v1/:splat"
#   status = 200
#   force = true`}
        />
        <P>A status of <C>200</C> makes Netlify proxy the request instead of redirecting the browser.</P>

        <h3 className="text-base font-semibold text-foreground">Cloudflare</h3>
        <P>
          A Pages <C>_redirects</C> file cannot do this: its <C>200</C> rewrites only apply to paths on
          your own site, not to another domain. Use a Worker route (or a Pages Function) on your zone:
        </P>
        <CodeBlock
          filename="worker.js"
          language="js"
          code={`export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/_seentics/trackers/')) return fetch(request); // not ours
    const target = 'https://seentics.com/trackers/' + url.pathname.slice('/_seentics/trackers/'.length);
    return fetch(target, { cf: { cacheEverything: true, cacheTtl: 3600 } });
  },
};`}
        />
        <P>
          Route it to <C>yoursite.com/_seentics/*</C>. This is Mode A only. Do not use a Worker for the
          API: see the location caveat above, which applies to Workers as much as to other proxies.
        </P>

        <h3 className="text-base font-semibold text-foreground">nginx</h3>
        <CodeBlock
          filename="nginx.conf"
          language="nginx"
          code={`location /_seentics/trackers/ {
    proxy_pass https://seentics.com/trackers/;
    proxy_set_header Host seentics.com;
    proxy_ssl_server_name on;
    proxy_cache_valid 200 1h;
}

# Mode B only:
# location /_seentics/api/v1/ {
#     proxy_pass https://api.seentics.com/api/v1/;
#     proxy_set_header Host api.seentics.com;
#     proxy_ssl_server_name on;
#     proxy_set_header Origin $http_origin;
# }`}
        />
      </DocSection>

      <DocSection title="Check it">
        <Ul>
          <Li>Open your site with the Network tab open. <C>seentics.min.js</C> should come from <C>/_seentics/trackers/</C>, and the extension files that load after it from the same folder.</Li>
          <Li>The <C>collect</C> request goes to <C>api.seentics.com</C> (Mode A) or to your domain (Mode B), and returns <C>200</C>.</Li>
          <Li>In Seentics, visit from a different country than your server (a phone on mobile data is enough) and check the Countries report. A country that matches your host&apos;s data centre for every visit means the address is being lost.</Li>
        </Ul>
        <P>
          Back to <Link href="/docs/frameworks" className="text-primary hover:underline">Frameworks</Link>.
        </P>
      </DocSection>
    </DocPage>
  );
}
