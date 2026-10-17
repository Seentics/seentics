import { C, DocPage, DocSection, P } from '@/components/docs/DocsKit';
import { A, AgencyApiReference } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Agency API reference · Seentics docs',
  description:
    'Every Seentics agency API endpoint — overview, clients, websites, branding, custom domain, embeds and usage — with fields, example responses, and curl and Node examples.',
};

/** Generated from `features/agency/agency-api-spec.ts`, the same spec the workspace's API page renders. */
export default function AgencyApiReferencePage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Agency API reference"
      lead="Every endpoint of the agency API, with its fields, an example response, and curl and Node examples."
    >
      <DocSection>
        <P>
          Authenticate with an account API key in <C>X-API-Key</C>; <C>GET</C> needs <C>agency:read</C>{' '}
          and everything else <C>agency:write</C>. Send an <C>Idempotency-Key</C> on every <C>POST</C>. How
          authentication, errors, pagination and rate limits work is on the{' '}
          <A href="/docs/agency/api">Agency API</A> page.
        </P>
      </DocSection>
      <AgencyApiReference />
    </DocPage>
  );
}
