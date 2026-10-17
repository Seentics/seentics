import { C, Callout, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';
import { A, B } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Clients & websites · Seentics docs',
  description:
    'Add clients to the Seentics agency workspace, group their websites, archive or delete a client, and move websites between clients.',
};

export default function AgencyClientsPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Clients & websites"
      lead="A client is one of your customers. Its websites sit under it, so you can see, share and manage them together."
    >
      <DocSection title="Add a client">
        <Ul>
          <Li>
            Open <B>Clients</B> and add a client.
          </Li>
          <Li>
            Enter its <B>Name</B>. <B>Company</B> and <B>Private notes</B> are optional; notes are only
            ever seen by you and your team.
          </Li>
          <Li>
            Open the client to add its websites, see each site&apos;s tracking status, set its{' '}
            <B>Features</B> and make <A href="/docs/agency/embeds">embed links</A>.
          </Li>
        </Ul>
        <P>
          Use <B>Edit details</B> on the client&apos;s page or in its menu to rename it or change its notes. The list has{' '}
          <B>Active</B>, <B>Archived</B> and <B>All</B> tabs, and a search box.
        </P>
      </DocSection>

      <DocSection title="Add a website to a client">
        <P>
          On the client&apos;s page choose <B>Add website</B>, and enter the site&apos;s name and address. The
          install snippet appears straight away — see{' '}
          <A href="/docs/agency/install-and-verify">Install &amp; verify</A>.
        </P>
        <Callout kind="tip" title="One website per address">
          Each website only accepts data from its own hostname, so <C>shop.client.com</C> and{' '}
          <C>blog.client.com</C> stay apart when each has its own website. Add as many as you like:
          websites are unlimited on Agency.
        </Callout>
      </DocSection>

      <DocSection title="The Websites page">
        <P>
          <B>Websites</B> lists every website in your account, under a client or not. Each row&apos;s menu
          has:
        </P>
        <Ul>
          <Li>
            <B>Move to client</B> — put the website under another client, or under <B>No client</B>. Its
            data moves with it.
          </Li>
          <Li>
            <B>Install &amp; embed</B> — its snippet, tracking status and embed links.
          </Li>
          <Li>
            <B>Open dashboard</B> — the full Seentics dashboard for that site.
          </Li>
          <Li>
            <B>Delete</B> — deletes the website and everything it collected, for good, and its
            snippet stops recording.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Archive, restore and delete">
        <RefTable
          columns={['Action', 'What happens']}
          rows={[
            [
              <B key="a">Archive</B>,
              'The client moves to the Archived tab and its websites stop collecting data. Everything collected so far is kept.',
            ],
            [
              <B key="u">Unarchive</B>,
              'The client is active again and its websites start collecting again.',
            ],
            [
              <B key="d">Delete</B>,
              'The client is removed. Its websites stay in your account, keep tracking, and are no longer under any client. Nothing they collected is deleted.',
            ],
          ]}
        />
        <Callout kind="warning" title="Deleting a client does not delete its websites">
          To remove a client&apos;s data as well, delete each of its websites from the <B>Websites</B>{' '}
          page first.
        </Callout>
      </DocSection>

      <DocSection title="Features per client">
        <P>
          The <B>Features</B> table on a client&apos;s page sets each dashboard page to <B>Off</B>,{' '}
          <B>View</B> or <B>Edit</B> for that client. It is saved now and applied once{' '}
          <A href="/docs/agency/client-sign-in">client sign-in</A> arrives.
        </P>
      </DocSection>
    </DocPage>
  );
}
