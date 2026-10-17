import { C, Callout, CodeBlock, DocPage, DocSection, Li, Ol, Oli, P, RefTable, Ul } from '@/components/docs/DocsKit';
import { A, AgencyErrorTable, AgencyQuickStart } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Agency API · Seentics docs',
  description:
    'Automate the Seentics agency workspace: authenticate with an account API key, onboard a client in four calls, and handle errors, idempotency and rate limits.',
};

export default function AgencyApiPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Agency API"
      lead="Everything the agency workspace does — clients, websites, install checks, branding, your domain, embed links and usage — from your own backend."
    >
      <DocSection title="Base URL">
        <CodeBlock language="text" filename="base URL" code="https://api.seentics.com/api/v1/agency" />
        <P>
          JSON in, JSON out. Every endpoint, with its fields and examples, is in the{' '}
          <A href="/docs/agency/api/reference">API reference</A>.
        </P>
      </DocSection>

      <DocSection id="authentication" title="Authentication">
        <P>Send an account API key in the <C>X-API-Key</C> header.</P>
        <Ol>
          <Oli>
            Open any website&apos;s <C>Developers</C> page, <C>API keys</C> tab, and choose{' '}
            <C>New account key</C>. From the workspace, <C>API → Create an API key</C> opens it for you
            (<C>/websites/&lt;id&gt;/developers?new=agency</C>).
          </Oli>
          <Oli>
            Pick the <C>Agency API</C> access preset. It grants <C>agency:read</C> and{' '}
            <C>agency:write</C>.
          </Oli>
          <Oli>Copy the key — it is shown once — and keep it on your server. Never put it in a browser or an app.</Oli>
        </Ol>
        <RefTable
          columns={['Scope', 'Allows']}
          rows={[
            [<C key="r">agency:read</C>, <><C>GET</C> requests.</>],
            [<C key="w">agency:write</C>, <>Everything else: <C>POST</C>, <C>PUT</C>, <C>PATCH</C>, <C>DELETE</C>.</>],
          ]}
        />
        <P>
          Scopes are strict: <C>agency:write</C> does not include reading, so a key that creates clients
          and lists them needs both. A missing scope is <C>403 forbidden</C>. Keys can only be created by
          someone signed in, never by another key. More on keys in{' '}
          <A href="/docs/api-keys">API keys</A>.
        </P>
        <P>
          The workspace itself uses the same API with your dashboard session. Team members can use it if
          their role allows managing the agency workspace.
        </P>
        <Callout kind="note" title="Agency plan required">
          Every request needs the account to be on the Agency plan. Otherwise the answer is{' '}
          <C>403 agency_plan_required</C>.
        </Callout>
      </DocSection>

      <DocSection id="quick-start" title="Quick start">
        <P>
          Onboard a client end to end: create the client, add its website, get the install snippet, and
          read this month&apos;s usage. Put your key in an environment variable first:
        </P>
        <CodeBlock language="bash" code="export SEENTICS_API_KEY=snt_acct_your_account_key" />
        <AgencyQuickStart />
        <P>
          Once the snippet is on the site and it has had a visitor, <C>POST /agency/websites/:id/verify</C>{' '}
          answers <C>receiving</C>.
        </P>
      </DocSection>

      <DocSection id="responses" title="Responses and pagination">
        <Ul>
          <Li>
            Success is <C>{'{ "data": … }'}</C>. Creating something answers <C>201</C>; deletes answer <C>204</C> with no
            body.
          </Li>
          <Li>
            Lists add <C>{'"page": { "next_cursor", "has_more" }'}</C>. Ask for up to 100 rows with{' '}
            <C>?limit=</C> (default 25), and for the next page pass <C>?cursor=</C> with the previous{' '}
            <C>next_cursor</C>. Stop when <C>has_more</C> is <C>false</C>.
          </Li>
          <Li>
            Every response carries an <C>X-Request-ID</C> header. Send your own <C>X-Request-ID</C> to tie
            our logs to yours.
          </Li>
        </Ul>
        <CodeBlock
          language="json"
          filename="GET /agency/clients?limit=25"
          code={`{
  "data": [{ "id": "5bbeaa88-…", "name": "Acme Bakery", "status": "active", … }],
  "page": { "next_cursor": null, "has_more": false }
}`}
        />
      </DocSection>

      <DocSection id="errors" title="Errors">
        <P>
          Errors share one shape. Switch on <C>code</C>, show <C>message</C> to a person, and quote{' '}
          <C>request_id</C> when you contact support.
        </P>
        <CodeBlock
          language="json"
          filename="422"
          code={`{
  "error": {
    "code": "validation_failed",
    "message": "name: Required",
    "details": { … },
    "request_id": "b3f1c2a4-…"
  }
}`}
        />
        <AgencyErrorTable />
        <P>
          <C>details</C> appears when there is more to say — the field that failed, or the scope a key is
          missing (<C>required_scope</C>).
        </P>
      </DocSection>

      <DocSection id="idempotency" title="Idempotency">
        <P>
          Send an <C>Idempotency-Key</C> header — any unique string up to 255 characters, such as a UUID —
          on every <C>POST</C>. Then a retry after a timeout can&apos;t create the same client twice.
        </P>
        <Ul>
          <Li>
            A retry with the same key and the same body, within 24 hours, gets the first response again,
            with the header <C>Idempotent-Replayed: true</C>. Nothing runs twice.
          </Li>
          <Li>
            The same key with a different body is <C>409 idempotency_conflict</C>.
          </Li>
          <Li>
            The same key while the first request is still running is <C>409 conflict</C>; retry shortly.
          </Li>
          <Li>
            If the first request failed with a <C>5xx</C>, the key is released and a retry runs again.
          </Li>
        </Ul>
        <P>
          Keys are per account, and only <C>POST</C> uses them: repeating a <C>PUT</C> or <C>PATCH</C> gives
          the same result anyway.
        </P>
      </DocSection>

      <DocSection id="rate-limits" title="Rate limits">
        <RefTable
          columns={['Caller', 'Limit']}
          rows={[
            ['An API key', '120 requests a minute, of which up to 60 may be writes'],
            ['A dashboard session', '600 requests a minute per account'],
            ['Adding or replacing the custom domain', '10 times an hour'],
          ]}
        />
        <P>
          Over the limit, the answer is <C>429 rate_limited</C> with a <C>Retry-After</C> header in seconds.
          Wait that long, then retry — with the same <C>Idempotency-Key</C> for a <C>POST</C>.
        </P>
      </DocSection>
    </DocPage>
  );
}
