import { DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';
import { A, B, ComingSoon } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Client sign-in (coming soon) · Seentics docs',
  description:
    'Coming soon to Seentics Agency: clients sign in to their own dashboard with an email link, and see only the pages you choose.',
};

export default function AgencyClientSignInPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Client sign-in"
      lead="Let each client sign in to their own dashboard, showing only their websites and only the pages you pick."
    >
      <DocSection>
        <ComingSoon>
          Client sign-in is not available yet. It arrives in the next update. This page describes what is
          planned, and what you can set up today so it works from day one.
        </ComingSoon>
      </DocSection>

      <DocSection title="What’s planned">
        <Ul>
          <Li>
            <B>Invite client users</B> from a client&apos;s page, by email.
          </Li>
          <Li>
            <B>Sign-in by email link</B> — no password to remember. Your client enters their email and gets
            a link that signs them in.
          </Li>
          <Li>
            <B>Only their websites</B> — a client user sees the websites under their client, nothing else in
            your account.
          </Li>
          <Li>
            <B>Only the pages you choose</B> — each dashboard page is Off, View or Edit, per client, from
            the <B>Features</B> table.
          </Li>
          <Li>
            <B>Your branding</B> on the sign-in page and the dashboard.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Get ready now">
        <Ul>
          <Li>
            Set each client&apos;s <B>Features</B> on its page — saved now, applied when sign-in ships. See{' '}
            <A href="/docs/agency/clients-and-websites">Clients &amp; websites</A>.
          </Li>
          <Li>
            Save your brand and a sign-in name, and connect your domain — see{' '}
            <A href="/docs/agency/branding-and-domain">Branding &amp; domain</A>.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Until then">
        <P>
          Share a read-only dashboard with an <A href="/docs/agency/embeds">embed link</A>. It needs no
          account, so treat the link like a password.
        </P>
      </DocSection>
    </DocPage>
  );
}
