import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'API keys · Seentics docs',
  description: 'Create a Seentics API key, choose its scopes, and use it safely.',
};

export default function ApiKeysPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="API keys"
      lead="One account key, scoped to what each integration needs. It manages your clients and websites and reads their data, by id."
    >
      <DocSection title="Creating a key">
        <Ul>
          <Li>
            Open <C>Agency → API keys</C> and choose <C>New API key</C>.
          </Li>
          <Li>Give the key a name that says where it will be used — you will thank yourself later.</Li>
          <Li>Pick its access, and only as much as the integration needs.</Li>
        </Ul>
        <Callout kind="warning" title="The secret is shown once">
          Only a hash is stored, so the full key cannot be shown again. Copy it when it appears; if
          you lose it, delete the key and make another.
        </Callout>
      </DocSection>

      <DocSection title="Access">
        <Ul>
          <Li>
            <strong>Full access</strong> — create and manage clients and websites, and read their analytics,
            recordings and heatmaps.
          </Li>
          <Li>
            <strong>Read only</strong> — list clients and websites and read their data. Cannot change anything.
          </Li>
          <Li>
            <strong>Manage only</strong> — create, update and delete clients and websites. Cannot read data.
          </Li>
        </Ul>
        <P>
          Under the hood a key holds scopes: <C>websites:read</C> and <C>websites:write</C> for the{' '}
          Management API, and <C>analytics:read</C>, <C>replays:read</C> and <C>heatmaps:read</C> for
          the data API. Each endpoint requires one, and a key without it gets <C>403</C>. A key can only
          reach websites in its own account.
        </P>
      </DocSection>

      <DocSection title="Using a key">
        <P>
          Send it as an <C>X-API-Key</C> header. Never as a query parameter — URLs end up in server
          logs, browser history and referrer headers.
        </P>
        <CodeBlock
          language="bash"
          code={`curl -H "X-API-Key: $SEENTICS_API_KEY" \
  "https://app.seentics.com/api/v1/raw/v1/catalogue"`}
        />
        <CodeBlock
          language="js"
          filename="report.js"
          code={`// websiteId is the id returned when you created the website
const res = await fetch(
  \`https://app.seentics.com/api/v1/raw/v1/websites/\${websiteId}/analytics/daily-stats\`,
  { headers: { 'X-API-Key': process.env.SEENTICS_API_KEY } },
);`}
        />
        <P>
          The API reference in <C>Agency → Analytics API</C> shows the required scope beside every
          endpoint.
        </P>
      </DocSection>

      <DocSection title="Keeping keys safe">
        <Ul>
          <Li>
            Keep keys server-side. A key in browser JavaScript is a public key — anyone can read it
            from the network tab. To show a tenant its own numbers in a page, use an embed link instead.
          </Li>
          <Li>One key per integration, so you can revoke one without breaking the others.</Li>
          <Li>Choose the narrowest access. A reporting job does not need to manage websites.</Li>
          <Li>
            The dashboard shows each key&apos;s last-used time — a key that has not been used in
            months is a key to delete.
          </Li>
        </Ul>
        <P>
          See the <Link href="/docs/api" className="text-primary hover:underline">REST API</Link>{' '}
          page for base URLs and error codes.
        </P>
      </DocSection>
    </DocPage>
  );
}
