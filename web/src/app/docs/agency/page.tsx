import { C, Callout, DocPage, DocSection, Endpoint, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Agency · Seentics docs',
  description: 'Group sites under clients, control what each client gets, and provision them by API.',
};

/**
 * The management API is Core's `app/http/management-api/routes.ts`; the client routes it
 * mounts are the websites module's, the same ones the dashboard's Agency screens call.
 */
export default function AgencyPage() {
  return (
    <DocPage
      eyebrow="Platform"
      title="Agency"
      lead="Run many client sites from one account — or give every tenant of your own product its own tracking — and decide what each one gets."
    >
      <DocSection title="What it adds">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Clients</strong> — group websites under a
            client: an agency&apos;s customer, or one tenant of a multi-tenant product.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Feature switches</strong> — turn
            recordings, heatmaps, funnels, automations or error tracking off for one client. The
            tracker stops collecting them on that client&apos;s sites.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Limits</strong> — cap a client&apos;s
            websites, and its events, recordings and heatmap pages per month. Tenant one can get 10k
            events and 100 recordings, tenant two 150 recordings.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Management API</strong> — do all of the
            above from your own backend with an account key.
          </Li>
        </Ul>
        <P>
          Agency features are included on every plan. Your plan&apos;s limits still apply across all
          clients together; a client&apos;s limits divide that up.
        </P>
      </DocSection>

      <DocSection title="Provision a tenant at signup">
        <P>
          Create an account key under <C>Agency → API keys</C>, keep it on your server, and call
          this from your signup handler. It creates the client and its website and returns the
          snippet to install on the tenant&apos;s pages.
        </P>
        <Endpoint method="POST" path="/api/v1/manage/clients">
          Body: <C>external_id</C> (your id for the tenant), <C>name</C>, and optionally{' '}
          <C>website.url</C>, <C>features_enabled</C> and <C>limits</C>. Send the same{' '}
          <C>external_id</C> again and you get the same client back with <C>created: false</C> —
          retries never make a second tenant.
        </Endpoint>
        <Callout kind="tip" title="One site per subdomain">
          Each website only accepts data from its own hostname, so <C>a.yourapp.com</C> and{' '}
          <C>b.yourapp.com</C> stay separate when each tenant gets its own website.
        </Callout>
      </DocSection>

      <DocSection title="Endpoints">
        <P>
          Under <C>/api/v1/manage</C>, authenticated with an account key in <C>X-API-Key</C>.{' '}
          <C>GET</C> needs a read key; everything else a read &amp; write key.
        </P>
        <Endpoint method="GET" path="/api/v1/manage/clients">
          Your clients with their websites; <C>?external_id=</C> looks one up by your id.
        </Endpoint>
        <Endpoint method="PATCH" path="/api/v1/manage/clients/:id">
          Status, feature switches and limits. Each merges into what is set, so one key changes one
          thing; a limit of <C>null</C> removes the cap. A suspended client&apos;s sites stop collecting.
        </Endpoint>
        <Endpoint method="DELETE" path="/api/v1/manage/clients/:id">
          Removes the client and keeps its websites, ungrouped — or deletes them too with{' '}
          <C>?delete_websites=true</C>.
        </Endpoint>
        <Endpoint method="POST" path="/api/v1/manage/websites">
          A website on its own, or under a client with <C>client_id</C>.
        </Endpoint>
        <Endpoint method="PATCH" path="/api/v1/manage/websites/:id">
          Change a website, or move it between clients with <C>client_id</C> (<C>null</C> ungroups it).
        </Endpoint>
        <Endpoint method="POST" path="/api/v1/manage/websites/:id/embed-link">
          A permanent link to a read-only dashboard of one website, for an iframe in your own app. Calling it
          again returns the same link; <C>DELETE</C> on the same path revokes it.
        </Endpoint>
        <Endpoint method="POST" path="/api/v1/manage/clients/:id/embed-link">
          The same for a whole client: the embed gets a switcher across all of that client&apos;s websites.
        </Endpoint>
        <Endpoint method="PATCH" path="/api/v1/manage/websites/:id/embed-link">
          Change which sections the link shows (<C>{'{ "sections": [...] }'}</C>). The URL stays the same and
          the change applies at once. <C>/clients/:id/embed-link</C> works the same way.
        </Endpoint>
        <P>
          A link chooses its sections: <C>analytics</C> (on by default), <C>recordings</C> and{' '}
          <C>heatmaps</C> (both off by default). Send <C>sections</C> in the <C>POST</C> body to pick them when
          the link is made. Recordings show real visitor sessions, so enable them deliberately.
        </P>
        <Callout kind="tip" title="Treat an embed link like a secret">
          It never expires, and anyone who holds the URL can see those analytics. Keep it behind your own
          login, and revoke it if it leaks.
        </Callout>
        <P>
          Every endpoint, with its body and an example response, is under <C>Agency → Management API</C> in the
          dashboard.
        </P>
      </DocSection>

      <DocSection title="In Seentics Cloud">
        <P>
          Cloud adds client logins, portal links that show one client their own dashboard, and
          white-label — your name, colours and domain on what clients see.
        </P>
      </DocSection>
    </DocPage>
  );
}
