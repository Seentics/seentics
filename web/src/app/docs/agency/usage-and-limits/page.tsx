import { C, Callout, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';
import { A, B, ComingSoon } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Agency usage & limits · Seentics docs',
  description:
    'What the Seentics Agency plan includes each month, how usage is shared across clients, and what happens when you go past it.',
};

export default function AgencyUsagePage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Usage & limits"
      lead="One monthly allowance shared by every client. The Usage page shows how much is left and who is using it."
    >
      <DocSection title="The Agency plan">
        <P>
          $99 a month, or $990 a year. Every month it includes:
        </P>
        <RefTable
          columns={['Included', 'Amount']}
          rows={[
            ['Events', '15 million'],
            ['Session recordings', '30,000'],
            ['Contacts & form submissions', '200,000'],
            ['AI analyses', '1,000'],
            ['Websites, heatmaps, funnels, automations and ad platforms', 'Unlimited'],
            ['Analytics retention', '3 years'],
            ['Session replay retention', '90 days'],
          ]}
        />
        <P>
          It also includes everything on this section&apos;s pages: the agency workspace, clients,
          white-label branding, your own domain, embed links and the agency API. Each of these needs the
          Agency plan for every action — if your account moves to another plan, the workspace and the API
          refuse requests and embed links stop loading.
        </P>
      </DocSection>

      <DocSection title="One shared pool">
        <P>
          The allowance is for your whole account, not per client. Every client&apos;s websites draw on the
          same pool, and so do websites that aren&apos;t under a client. Usage is counted per calendar month
          in UTC.
        </P>
        <ComingSoon title="Limits per client — coming soon">
          Setting how much of the pool each client or website may use, with alerts when one gets close, is
          coming in a later update. The <B>Allocated</B> column on the Usage page stays at zero until then.
        </ComingSoon>
      </DocSection>

      <DocSection title="The Usage page">
        <Ul>
          <Li>
            <B>Pool</B> — for events, recordings, leads (contacts and form submissions) and AI analyses:
            what has been used this month, your plan&apos;s pool, and any overage.
          </Li>
          <Li>
            <B>By client</B> — each client&apos;s use this month.
          </Li>
          <Li>
            <B>By website</B> — each website&apos;s use, with a filter for one client.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Going past the allowance">
        <Ul>
          <Li>
            Without Extra usage, collecting that kind of data pauses until next month once the allowance is
            used up. Nothing is lost that was already collected.
          </Li>
          <Li>
            With <B>Extra usage</B> on (in <C>Settings → Billing</C>), collecting carries on and the extra is
            billed at the end of the month, up to a spend cap you set. The rates are on{' '}
            <A href="/docs/billing">Billing &amp; plans</A>.
          </Li>
          <Li>
            You get an email at 80% and at 100% of your monthly events, so you can act before anything
            pauses.
          </Li>
        </Ul>
        <Callout kind="tip" title="Turn on Extra usage for client work">
          A paused site means a gap in a client&apos;s reports. Turning on Extra usage with a spend cap you
          are comfortable with keeps every client collecting.
        </Callout>
      </DocSection>

      <DocSection title="From your own code">
        <P>
          <C>GET /api/v1/agency/usage</C> returns the pool, use and overage;{' '}
          <C>/usage/clients</C> and <C>/usage/websites</C> break it down, and <C>?month=YYYY-MM</C> reads
          an earlier month. See the <A href="/docs/agency/api/reference#usage">API reference</A>.
        </P>
      </DocSection>
    </DocPage>
  );
}
