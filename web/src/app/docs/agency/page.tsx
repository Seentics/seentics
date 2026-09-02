import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Endpoint, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Agency · Seentics docs',
  description: 'Manage client sites, give clients their own logins, and white-label the dashboard.',
};

/**
 * Condensed from a 672-line page plus four anchor sections on the old index, which
 * between them documented `Authorization: Bearer snt_age_...` — a header the server
 * does not accept and a key prefix that has never existed.
 *
 * Endpoints are shown under the `/user/agency/*` paths the dashboard itself calls
 * (see `lib/agency-api.ts`), relative to the `/api/v1` base.
 */
export default function AgencyPage() {
  return (
    <DocPage
      eyebrow="Platform"
      title="Agency"
      lead="Run many client sites from one account, and let clients see their own data without seeing yours."
    >
      <DocSection title="What it adds">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Clients</strong> — group websites under a
            client, so billing and reporting follow the relationship rather than the site list.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Client users</strong> — give a client a
            login that sees only their own sites.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">White label</strong> — your name and
            colours on the dashboard the client logs into.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Agency API keys</strong> — provision the
            above from your own systems instead of the dashboard.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Two ways to work">
        <P>
          Everything is available in the dashboard under <C>Agency</C>, with no code. If you onboard
          clients from your own admin or a signup flow, the same operations are on the API — one
          request per client instead of a form.
        </P>
      </DocSection>

      <DocSection title="Endpoints">
        <P>
          Relative to <C>/api/v1</C>, authenticated with an <C>X-API-Key</C> header like the rest of
          the API.
        </P>
        <Endpoint method="GET" path="/api/v1/user/agency/clients">
          Your clients, and the websites under each.
        </Endpoint>
        <Endpoint method="GET" path="/api/v1/user/agency/client-users">
          Client logins and which client each belongs to.
        </Endpoint>
        <Endpoint method="GET" path="/api/v1/user/agency/white-label">
          The current white-label configuration.
        </Endpoint>
        <Endpoint method="GET" path="/api/v1/user/agency/api-keys">
          Agency-scoped keys.
        </Endpoint>
        <Callout kind="warning" title="Not a Bearer token, and no snt_age_ prefix">
          Earlier docs showed <C>Authorization: Bearer snt_age_...</C>. The server accepts{' '}
          <C>X-API-Key</C>, and keys are <C>snt_</C> plus a site slice — there has never been an{' '}
          <C>snt_age_</C> form. Creating and reading keys is covered in{' '}
          <Link href="/docs/api-keys" className="text-primary hover:underline">API keys</Link>.
        </Callout>
        <P>
          The write operations for each of these are in the catalogue described on the{' '}
          <Link href="/docs/api" className="text-primary hover:underline">REST API</Link> page,
          generated from the router so it cannot describe a route that no longer exists.
        </P>
      </DocSection>

      <DocSection title="Client portals">
        <P>
          A client portal is a link that shows one client their own dashboard without an account.
          Useful for a monthly report you do not want to export by hand. Portal links are
          unguessable and are excluded from search engines.
        </P>
      </DocSection>

      <DocSection title="Getting access">
        <P>
          Agency features are part of the Agency plan — see the{' '}
          <Link href="/pricing" className="text-primary hover:underline">pricing page</Link>, or{' '}
          <Link href="/contact" className="text-primary hover:underline">get in touch</Link> if you
          are moving a portfolio across.
        </P>
      </DocSection>
    </DocPage>
  );
}
