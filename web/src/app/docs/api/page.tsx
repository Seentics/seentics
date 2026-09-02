import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Endpoint, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'REST API · Seentics docs',
  description: 'Read your Seentics data from your own tools. Base URL, authentication and the live endpoint catalogue.',
};

/**
 * Deliberately does not contain an endpoint table.
 *
 * The page this replaces hand-listed endpoints and documented
 * `Authorization: Bearer YOUR_API_KEY` in eight places. The server accepts
 * `X-API-Key` (see `curlFor` in `lib/api-keys-api.ts`), so every example in those
 * docs returned 401 — and the endpoint list had drifted from the router besides.
 *
 * `components/developers/ApiReferencePanel` already solves this: it renders the
 * catalogue the server publishes at `GET /api/v1/raw/v1/catalogue`, so it "cannot
 * document an endpoint that does not exist, or miss one that does". That endpoint
 * needs a key, so a public page cannot render it — which is exactly why this page
 * documents only what is stable and sends you to the in-app reference for the list,
 * rather than starting a third copy that will drift again.
 */
export default function ApiPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="REST API"
      lead="Read your own analytics, replays and heatmap data from your own tools."
    >
      <DocSection title="Base URL">
        <P>
          Every endpoint lives under <C>/api/v1</C> on your Seentics host. On the hosted service
          that is:
        </P>
        <CodeBlock language="text" code={`https://app.seentics.com/api/v1`} />
        <P>
          Self-hosting? Use your own origin. The path is the same.
        </P>
      </DocSection>

      <DocSection title="Authentication">
        <P>
          Send your API key in an <C>X-API-Key</C> header. Every request needs one — there are no
          unauthenticated read endpoints.
        </P>
        <CodeBlock
          language="bash"
          code={`curl -H "X-API-Key: $SEENTICS_API_KEY" \\
  "https://app.seentics.com/api/v1/raw/v1/catalogue"`}
        />
        <Callout kind="warning" title="Not a Bearer token">
          Earlier versions of these docs showed{' '}
          <C>Authorization: Bearer YOUR_API_KEY</C>. The server does not accept that and will
          answer <C>401</C>. Use <C>X-API-Key</C>.
        </Callout>
        <P>
          See <Link href="/docs/api-keys" className="text-primary hover:underline">API keys</Link>{' '}
          for creating one and choosing its scopes.
        </P>
      </DocSection>

      <DocSection title="The endpoint catalogue">
        <P>
          Rather than a list here that can fall behind the server, Seentics publishes its own
          catalogue. Every endpoint, its parameters, its required scope and a copy-paste{' '}
          <C>curl</C> example are generated from the router itself.
        </P>
        <Endpoint method="GET" path="/api/v1/raw/v1/catalogue">
          The full list of readable endpoints, with parameters and scopes. Requires a key.
        </Endpoint>
        <P>
          The dashboard renders the same catalogue for you, already filled in with your website ID.
          Open <C>Developers → API reference</C> on any site — that is the authoritative list, and
          it cannot describe an endpoint that no longer exists.
        </P>
        <Callout kind="tip" title="Why it lives there and not here">
          A hand-written endpoint table in docs drifts the moment a route changes, and this one had.
          Generating it from the router is the only version that stays true.
        </Callout>
      </DocSection>

      <DocSection title="What is available">
        <P>
          The API is grouped by module. These are the mount points; the catalogue has the endpoints
          under each.
        </P>
        <RefTable
          columns={['Group', 'Path prefix', 'Covers']}
          rows={[
            [<C>raw</C>, <C>/api/v1/raw</C>, 'Raw events, heatmap points and recording metadata — the reporting surface most integrations want.'],
            [<C>analytics</C>, <C>/api/v1/analytics</C>, 'Aggregated traffic, sources, devices and geography.'],
            [<C>funnels</C>, <C>/api/v1/funnels</C>, 'Funnel definitions and their step metrics.'],
            [<C>automations</C>, <C>/api/v1/automations</C>, 'Automation definitions and execution stats.'],
            [<C>replays</C>, <C>/api/v1/replays</C>, 'Session lists and recording payloads.'],
            [<C>heatmaps</C>, <C>/api/v1/heatmaps</C>, 'Click and scroll data per page.'],
            [<C>websites</C>, <C>/api/v1/websites</C>, 'Your sites, and the API keys attached to them.'],
            [<C>privacy</C>, <C>/api/v1/privacy</C>, 'Data export and deletion requests.'],
          ]}
        />
      </DocSection>

      <DocSection title="Errors">
        <P>
          Errors come back as JSON with an <C>error</C> field and the matching HTTP status.
        </P>
        <CodeBlock language="json" code={`{ "error": "Authorization header required" }`} />
        <Ul>
          <Li>
            <C>401</C> — no key, or a key the server does not recognise.
          </Li>
          <Li>
            <C>403</C> — the key is valid but lacks the scope for that endpoint, or is scoped to a
            different website.
          </Li>
          <Li>
            <C>404</C> — no such website, funnel, session or automation.
          </Li>
          <Li>
            <C>429</C> — rate limited. Back off and retry.
          </Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
