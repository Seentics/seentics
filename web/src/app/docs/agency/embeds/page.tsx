import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';
import { A, B } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Embed links · Seentics docs',
  description:
    'Share a read-only Seentics dashboard of one client website, or all of a client’s websites, with a link or an iframe.',
};

export default function AgencyEmbedsPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Embed links"
      lead="A read-only dashboard you can send to a client or put in an iframe — in your own client portal, an intranet or a report — without giving them an account."
    >
      <DocSection title="Two kinds">
        <RefTable
          columns={['Kind', 'Shows', 'Where to make it']}
          rows={[
            [<B key="c">Client</B>, 'All of that client’s websites together.', <>The client&apos;s page, <B>Embed links</B> panel.</>],
            [<B key="w">Website</B>, 'One website.', <><B>Install</B> on the client&apos;s page, or <B>Install &amp; embed</B> on the Websites page.</>],
          ]}
        />
        <P>Each client and each website has at most one embed link.</P>
      </DocSection>

      <DocSection title="Create and share one">
        <Ul>
          <Li>
            In the <B>Embed links</B> panel, create the link. It starts with <B>Analytics</B> on.
          </Li>
          <Li>
            Choose what it shows with the switches. At least one must stay on:
          </Li>
        </Ul>
        <RefTable
          columns={['Section', 'Shows']}
          rows={[
            [<B key="a">Analytics</B>, 'Traffic, pages, sources, countries and devices.'],
            [<B key="r">Session recordings</B>, 'Replays of real visitor sessions.'],
            [<B key="h">Heatmaps</B>, 'Clicks, movement and scroll on each page.'],
          ]}
        />
        <Ul>
          <Li>
            <B>Copy</B> the link and send it, or put it in an iframe. Changing the sections later keeps the
            same link.
          </Li>
        </Ul>
        <CodeBlock
          language="html"
          filename="your-portal.html"
          code={`<iframe
  src="PASTE_THE_EMBED_LINK_HERE"
  style="width: 100%; height: 900px; border: 0"
  loading="lazy"
></iframe>`}
        />
      </DocSection>

      <DocSection title="Keep it safe">
        <Callout kind="warning" title="Treat an embed link like a password">
          It never expires, and anyone who has the URL can see what it shows — no sign-in needed. Share it
          only with the client, put it behind your own login when you embed it, and think twice before
          turning on <B>Session recordings</B>.
        </Callout>
        <P>
          If a link leaks, or a client leaves, <B>Revoke</B> it. Anyone using it loses access at once. If
          you create a new one, it gets a new address.
        </P>
        <P>
          Embed links need the Agency plan: if your account leaves Agency, they stop loading. An archived
          client&apos;s websites stop collecting, so their embed shows no new data.
        </P>
      </DocSection>

      <DocSection title="From your own code">
        <P>
          <C>POST /api/v1/agency/embeds</C> creates a link with a <C>scope</C> of <C>client</C> or{' '}
          <C>website</C>; <C>PATCH</C> changes its sections and <C>DELETE</C> revokes it. See the{' '}
          <A href="/docs/agency/api/reference#embeds">API reference</A>.
        </P>
      </DocSection>
    </DocPage>
  );
}
