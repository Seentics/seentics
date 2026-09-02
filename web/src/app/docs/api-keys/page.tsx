import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Endpoint, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'API keys · Seentics docs',
  description: 'Create a Seentics API key, choose its scopes, and use it safely.',
};

/**
 * The scope list is not written out here on purpose.
 *
 * The page this replaces named four scopes the backend has never accepted — the
 * in-app developers page carries a comment saying exactly that. Scopes come from
 * `GET /api/v1/websites/scopes`, which needs a key, so a public page cannot render
 * the live list. Naming them here again would just restart the drift.
 */
export default function ApiKeysPage() {
  return (
    <DocPage
      eyebrow="Integration"
      title="API keys"
      lead="One key per integration, scoped to the data it needs and to a single website."
    >
      <DocSection title="Creating a key">
        <Ul>
          <Li>
            Open <C>Developers → API keys</C> on the website you want to read.
          </Li>
          <Li>Give the key a name that says where it will be used — you will thank yourself later.</Li>
          <Li>Tick the scopes it needs, and only those.</Li>
        </Ul>
        <Callout kind="warning" title="The secret is shown once">
          Only a hash is stored, so the full key cannot be shown again. Copy it when it appears; if
          you lose it, delete the key and mint another.
        </Callout>
      </DocSection>

      <DocSection title="What a key looks like">
        <CodeBlock language="text" code={`snt_a1b2c3_K7pQ...`} />
        <P>
          The middle segment is a slice of the website ID, so a leaked key is traceable to a site
          without a database lookup. The random half is 32 bytes of base64url. The dashboard lists
          keys by their first 16 characters — that prefix is all it keeps in plain text.
        </P>
        <Callout kind="note" title="If you saw snt_live_ or snt_age_ in older docs">
          Those prefixes were never real. Keys have always been <C>snt_</C> plus a site slice.
        </Callout>
      </DocSection>

      <DocSection title="Using a key">
        <P>
          Send it as an <C>X-API-Key</C> header. Never as a query parameter — URLs end up in server
          logs, browser history and referrer headers.
        </P>
        <CodeBlock
          language="bash"
          code={`curl -H "X-API-Key: $SEENTICS_API_KEY" \\
  "https://app.seentics.com/api/v1/raw/v1/catalogue"`}
        />
        <CodeBlock
          language="js"
          filename="report.js"
          code={`const res = await fetch(
  'https://app.seentics.com/api/v1/raw/v1/catalogue',
  { headers: { 'X-API-Key': process.env.SEENTICS_API_KEY } },
);`}
        />
      </DocSection>

      <DocSection title="Scopes">
        <P>
          A key carries a set of scopes, and each endpoint requires one. A key built for traffic
          reporting cannot read session replays — that separation is the point of having scopes at
          all.
        </P>
        <P>
          The scope vocabulary is published by the server, so the current list is always the one in
          the dashboard when you create a key. The API reference in{' '}
          <C>Developers → API reference</C> shows the required scope beside every endpoint.
        </P>
        <Endpoint method="GET" path="/api/v1/websites/scopes">
          Every scope the server accepts, with a description. Requires a key.
        </Endpoint>
        <Callout kind="tip" title="Why the list is not printed here">
          It used to be, and four of the scopes named did not exist. A list in prose has no way to
          stay in step with the server; the dashboard reads it live.
        </Callout>
      </DocSection>

      <DocSection title="Keeping keys safe">
        <Ul>
          <Li>
            Keep keys server-side. A key in browser JavaScript is a public key — anyone can read it
            from the network tab.
          </Li>
          <Li>One key per integration, so you can revoke one without breaking the others.</Li>
          <Li>
            Scope narrowly. A reporting job does not need replay access.
          </Li>
          <Li>
            Keys are per website. A key for one site cannot read another, even under the same
            account.
          </Li>
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
