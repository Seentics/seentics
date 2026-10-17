import { C, Callout, DocPage, DocSection, Li, Ol, Oli, P, RefTable, Ul } from '@/components/docs/DocsKit';
import { A, B } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Client sign-in · Seentics docs',
  description:
    'Invite client users to Seentics Agency: they sign in to their own dashboard with an email link, and see only their websites and the pages you choose.',
};

export default function AgencyClientSignInPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Client sign-in"
      lead="Let each client sign in to their own dashboard, showing only their websites and only the pages you pick, under your brand."
    >
      <DocSection title="1. Set a sign-in name">
        <P>
          In <A href="/docs/agency/branding-and-domain">Branding &amp; domain</A>, save your brand and a{' '}
          <B>Sign-in name</B>, such as <C>meridian</C>. It makes your sign-in page:
        </P>
        <P>
          <C>https://seentics.com/signin?agency=meridian</C>
        </P>
        <P>
          That page shows your brand name, logo and colour. With <B>Hide Seentics branding</B> on, it
          shows no Seentics marks.
        </P>
      </DocSection>

      <DocSection title="2. Invite a client user">
        <Ol>
          <Oli>
            Open the client from <B>Clients</B> in the Agency workspace.
          </Oli>
          <Oli>
            In <B>Client sign-in</B>, choose <B>Invite</B>, enter their email and, if you like, their
            name.
          </Oli>
          <Oli>
            They get an email in your brand with a sign-in link. The link works once and lasts 15
            minutes.
          </Oli>
        </Ol>
        <P>
          The user shows as <B>Invited</B> until they first sign in, then <B>Active</B>. The panel also
          shows your sign-in link, ready to copy.
        </P>
      </DocSection>

      <DocSection title="3. Share the sign-in link">
        <P>
          Give clients your sign-in link to bookmark. They enter their email and get a new link each
          time. No passwords. The page never says whether an email belongs to a client user, so it
          cannot be used to check who your clients are.
        </P>
        <Callout kind="tip" title="Link expired?">
          A used or expired link shows a page to ask for a new one. You can also choose{' '}
          <B>Resend link</B> next to the user.
        </Callout>
      </DocSection>

      <DocSection title="What clients see">
        <Ul>
          <Li>
            <B>Only their websites</B>: the websites under their client, nothing else in your account.
          </Li>
          <Li>
            <B>Only the pages you choose</B>: pages set to View or Edit in the client&apos;s{' '}
            <B>Features</B> table. Pages set to Off are hidden from the sidebar and closed if opened by
            address.
          </Li>
          <Li>
            <B>Settings: Goals and Privacy only</B>, when you allow them. Never billing, team,
            developers, tracking code or deleting a site.
          </Li>
          <Li>
            <B>Your brand</B>: name, logo and colour on the dashboard. With <B>Hide Seentics branding</B>{' '}
            on, no Seentics links, chat or logo.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="View or Edit">
        <RefTable
          columns={['Setting', 'What the client can do']}
          rows={[
            [<B key="off">Off</B>, 'The page is hidden.'],
            [<B key="view">View</B>, 'Reads the page. Buttons that create, change or delete are hidden or disabled.'],
            [<B key="edit">Edit</B>, 'Reads the page and can create, change and delete there, such as funnels, goals or lead status.'],
          ]}
        />
        <P>
          The server enforces these, not just the dashboard: a request for a page that is off, or a
          change on a page set to View, is refused with <C>403 feature_not_allowed</C>. Changes in the
          Features table apply on the client&apos;s next page load.
        </P>
      </DocSection>

      <DocSection title="Revoking access">
        <RefTable
          columns={['Action', 'Effect']}
          rows={[
            [<B key="d">Disable</B>, 'Keeps the user but blocks sign-in and ends their sessions.'],
            [<B key="e">Enable</B>, 'Lets a disabled user sign in again.'],
            [<B key="r">Remove</B>, 'Deletes their access to this client.'],
            [<B key="s">Resend link</B>, 'Emails a fresh sign-in link.'],
          ]}
        />
        <P>
          To share a dashboard without a sign-in, use an <A href="/docs/agency/embeds">embed link</A>{' '}
          instead.
        </P>
      </DocSection>

      <DocSection title="With the API">
        <P>
          The same actions are in the <A href="/docs/agency/api/reference">Agency API</A>:
        </P>
        <Ul>
          <Li>
            <C>GET /agency/clients/:id/users</C> and <C>POST /agency/clients/:id/users</C> (
            <C>{'{ email, name? }'}</C>, sends the invite)
          </Li>
          <Li>
            <C>PATCH /agency/clients/:id/users/:userId</C> (<C>status</C>, <C>name</C>) and{' '}
            <C>DELETE /agency/clients/:id/users/:userId</C>
          </Li>
          <Li>
            <C>POST /agency/clients/:id/users/:userId/send-link</C>
          </Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
