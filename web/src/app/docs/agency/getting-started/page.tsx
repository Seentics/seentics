import { C, Callout, DocPage, DocSection, Ol, Oli, P } from '@/components/docs/DocsKit';
import { A, B } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Getting started with Agency · Seentics docs',
  description:
    'Set up the Seentics agency workspace in five steps: your brand and domain, your first client, a tracked website, and the pages each client sees.',
};

export default function AgencyGettingStartedPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Getting started"
      lead="Five steps take you from an empty workspace to a client site sending data under your brand. The workspace shows them as a checklist and ticks each one off."
    >
      <DocSection title="Before you start">
        <P>
          You need the Agency plan. Choose it under <C>Settings → Billing</C>, then open the workspace at{' '}
          <C>/agency</C>. While you have no clients, the overview page shows the setup checklist.
        </P>
      </DocSection>

      <DocSection title="1. Add your brand and domain">
        <P>
          Open <B>Branding &amp; domain</B>. Enter your brand name, a logo address, your colour, a support
          email and a footer line, then <B>Save branding</B>. The step is done once a brand name is saved.
          If you want client dashboards on your own
          address, add a subdomain such as <C>reports.youragency.com</C> under <B>Custom domain</B> and
          follow the DNS steps.
        </P>
        <P>
          More in <A href="/docs/agency/branding-and-domain">Branding &amp; domain</A>.
        </P>
      </DocSection>

      <DocSection title="2. Add your first client">
        <P>
          Open <B>Clients</B> and add one. A client groups the websites you run for one customer. Only
          the name is required; the company and private notes are optional.
        </P>
        <P>
          More in <A href="/docs/agency/clients-and-websites">Clients &amp; websites</A>.
        </P>
      </DocSection>

      <DocSection title="3. Add a website and install the snippet">
        <P>
          On the client&apos;s page, choose <B>Add website</B> and enter the site&apos;s name and address.
          You get its snippet straight away, with steps for HTML, Google Tag Manager, Next.js, WordPress,
          Shopify and npm. Put it on the site, open the site in a browser, then choose{' '}
          <B>Verify installation</B>. The step is done once events arrive.
        </P>
        <P>
          More in <A href="/docs/agency/install-and-verify">Install &amp; verify</A>.
        </P>
      </DocSection>

      <DocSection title="4. Invite a client user">
        <P>
          On the client&apos;s page, in <B>Client sign-in</B>, choose <B>Invite</B> and enter your
          client&apos;s email. They get an email in your brand with a link that signs them in to their
          own dashboard. The step is done once a client user is invited.
        </P>
        <P>
          Afterwards they sign in at your sign-in link, <C>https://seentics.com/signin?agency=your-name</C>{' '}
          (the sign-in name from step 1). More in <A href="/docs/agency/client-sign-in">Client sign-in</A>.
        </P>
      </DocSection>

      <DocSection title="5. Choose features and limits">
        <P>
          On a client&apos;s page, the <B>Features</B> table lists each dashboard page — Overview, Events,
          Recordings, Heatmaps, Funnels and the rest. Set each one to <B>Off</B>, <B>View</B> or{' '}
          <B>Edit</B> and choose <B>Save features</B>. The step is done once any client has a page set to
          View or Edit.
        </P>
        <Callout kind="note" title="Enforced for client users">
          Client users see only pages set to View or Edit, and change things only on pages set to Edit;
          the server refuses anything else. Usage limits per client are coming soon; until then every
          client draws on your plan&apos;s shared pool.
        </Callout>
      </DocSection>

      <DocSection title="What next">
        <Ol>
          <Oli>
            Check the <B>Overview</B> after a day or two for trends across clients.
          </Oli>
          <Oli>
            Keep an eye on <B>Usage</B> — see <A href="/docs/agency/usage-and-limits">Usage &amp; limits</A>.
          </Oli>
          <Oli>
            Automating onboarding? The <A href="/docs/agency/api">Agency API</A> does all of the above
            from your own code.
          </Oli>
        </Ol>
      </DocSection>
    </DocPage>
  );
}
