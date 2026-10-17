import { C, Callout, DocPage, DocSection, Endpoint, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Agency · Seentics docs',
  description: 'Run every client from one workspace, and do the same from your own backend with the agency API.',
};

/**
 * The agency API is the gateway's `routes/agency.ts` in front of Core's `modules/agency`; the full
 * reference (generated from `features/agency/agency-api-spec.ts`) is the workspace's API page.
 */
export default function AgencyPage() {
  return (
    <DocPage
      eyebrow="Platform"
      title="Agency"
      lead="Run many client sites from one account — or give every tenant of your own product its own tracking — from one workspace and one API."
    >
      <DocSection title="The agency workspace">
        <P>
          Agency accounts get a workspace at <C>/agency</C>, next to the per-website dashboard:
        </P>
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Overview</strong> — totals across every
            client, per-client trends and the sites moving most, or a setup guide while it is empty.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Clients and websites</strong> — group
            websites under a client, add a site and get its install snippet, and check that events are
            arriving. Archiving a client stops its sites collecting until it is restored.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Feature visibility</strong> — choose, per
            client, which dashboard pages its people will see: <C>off</C>, <C>view</C> or <C>edit</C>.
            Stored now; enforced once client sign-in arrives.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Branding</strong> — brand name, logo,
            colour, support email and footer, and your own domain (a subdomain such as{' '}
            <C>reports.youragency.com</C>, pointed at Seentics with a CNAME record).
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Usage</strong> — this month&apos;s use of
            your plan&apos;s pool, per client and per website.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Embeds</strong> — a read-only dashboard of
            one website, or of all of a client&apos;s, for an iframe in your own app.
          </Li>
        </Ul>
        <Callout kind="tip" title="Coming next">
          Client sign-in to the real dashboard (by email magic link), the dashboard on your own domain,
          and per-client limits with alerts follow in later releases.
        </Callout>
      </DocSection>

      <DocSection title="The agency API">
        <P>
          Everything the workspace does is available under <C>/api/v1/agency</C>. Create an account
          key on any website&apos;s <C>Developers → API keys</C> tab with the <C>Agency API</C> preset
          (scopes <C>agency:read</C> and <C>agency:write</C>), keep it on your server, and send it in{' '}
          <C>X-API-Key</C>. <C>GET</C> needs <C>agency:read</C>; everything else <C>agency:write</C>.
        </P>
        <Ul>
          <Li>Success is <C>{'{ data }'}</C>; lists add <C>{'page: { next_cursor, has_more }'}</C> (<C>?limit=</C> up to 100, <C>?cursor=</C>).</Li>
          <Li>Errors are <C>{'{ error: { code, message, details?, request_id } }'}</C>.</Li>
          <Li>
            Send an <C>Idempotency-Key</C> on every <C>POST</C>: a retry with the same key gets the first
            answer for 24 hours; the same key with a different body is <C>409 idempotency_conflict</C>.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Onboard a client">
        <Endpoint method="POST" path="/api/v1/agency/clients">
          Body: <C>name</C>, and optionally <C>company</C> and <C>notes</C>. Answers the client.
        </Endpoint>
        <Endpoint method="POST" path="/api/v1/agency/clients/:id/websites">
          Body: <C>name</C> and <C>url</C>. Answers <C>{'{ website, install }'}</C>: the snippet to put
          on the site&apos;s pages, and per-platform instructions.
        </Endpoint>
        <Endpoint method="GET" path="/api/v1/agency/websites/:id/install">
          The snippet again, with whether events are arriving (<C>receiving</C>, <C>stale</C> or{' '}
          <C>not_seen</C>). <C>POST …/verify</C> checks again now.
        </Endpoint>
        <Endpoint method="PATCH" path="/api/v1/agency/websites/:id">
          Rename a site, or move it between clients with <C>client_id</C> (<C>null</C> takes it out of any client).
        </Endpoint>
        <Callout kind="tip" title="One site per subdomain">
          Each website only accepts data from its own hostname, so <C>a.yourapp.com</C> and{' '}
          <C>b.yourapp.com</C> stay separate when each tenant gets its own website.
        </Callout>
        <P>
          Branding (<C>/agency/branding</C>), the custom domain (<C>/agency/domain</C>), feature visibility
          (<C>/agency/clients/:id/features</C>), embeds (<C>/agency/embeds</C>) and usage (<C>/agency/usage</C>)
          work the same way. Every endpoint, with its body, an example response and curl and Node
          examples, is on the workspace&apos;s <C>API</C> page.
        </P>
        <Callout kind="tip" title="Treat an embed link like a secret">
          It never expires, and anyone who holds the URL can see those analytics. Keep it behind your own
          login, and revoke it if it leaks.
        </Callout>
      </DocSection>

      <DocSection title="Plans">
        <P>
          On Seentics Cloud the workspace, the agency API and the Management API&apos;s websites
          endpoints (<C>/api/v1/manage/websites</C>) take the Agency plan (the agency API answers other
          accounts <C>403 agency_plan_required</C>); account keys and the Data API are on every plan. Your
          plan&apos;s limits apply across all clients together.
        </P>
      </DocSection>
    </DocPage>
  );
}
