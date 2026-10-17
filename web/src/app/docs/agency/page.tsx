import { C, Callout, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';
import { A, B } from '@/components/docs/agency/AgencyDocs';

export const metadata = {
  title: 'Agency · Seentics docs',
  description:
    'Run every client site from one Seentics workspace: clients, websites, install checks, white-label branding, embed links, usage and an API.',
};

export default function AgencyOverviewPage() {
  return (
    <DocPage
      eyebrow="Agency"
      title="Agency"
      lead="One workspace for every client you run websites for: group their sites, check tracking, share dashboards and put your own brand on it."
    >
      <DocSection title="What you get">
        <P>
          The Agency plan adds an agency workspace to your account at <C>/agency</C>, next to the
          dashboard you already use for each website. Every client&apos;s websites still have the full
          Seentics dashboard: analytics, session replays, heatmaps, funnels, automations and the rest.
          The workspace is where you look across all of them at once.
        </P>
        <P>
          Open it from the workspace switcher in the dashboard sidebar or on your websites list, or go
          straight to <C>/agency</C>.
        </P>
        <Callout kind="tip" title="Try it first">
          A live demo with sample clients is at <C>/agency?demo=1</C>. You can look around every page;
          changes are switched off there.
        </Callout>
        <Callout kind="note" title="Agency plan required">
          Every agency feature needs the Agency plan, for every action — in the workspace and in the API.
          See <A href="/docs/agency/usage-and-limits">Usage &amp; limits</A> for what it includes.
        </Callout>
      </DocSection>

      <DocSection title="A tour of the workspace">
        <Ul>
          <Li>
            <B>Overview</B> — totals across every client for the last 30 days against the 30 before,
            each client&apos;s trend, the websites moving most, and alerts. While you have no clients it
            shows the setup checklist instead.
          </Li>
          <Li>
            <B>Clients</B> — one entry per customer. Open a client to see its websites, install each
            one, choose which dashboard pages it will see, and create embed links.
          </Li>
          <Li>
            <B>Websites</B> — every website in your account, with or without a client. Move a site to
            another client, or open its dashboard.
          </Li>
          <Li>
            <B>Branding &amp; domain</B> — your brand name, logo, colour, support email and footer, and
            your own domain such as <C>reports.youragency.com</C>.
          </Li>
          <Li>
            <B>Usage</B> — this month&apos;s use of your plan, by client and by website.
          </Li>
          <Li>
            <B>API</B> — the same things from your own code, with an account API key.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Guides">
        <Ul>
          <Li>
            <A href="/docs/agency/getting-started">Getting started</A> — the five setup steps, in order.
          </Li>
          <Li>
            <A href="/docs/agency/clients-and-websites">Clients &amp; websites</A> — add, archive, restore
            and delete clients, and move websites between them.
          </Li>
          <Li>
            <A href="/docs/agency/install-and-verify">Install &amp; verify</A> — put the snippet on a
            client&apos;s site and confirm events arrive.
          </Li>
          <Li>
            <A href="/docs/agency/branding-and-domain">Branding &amp; domain</A> — white label, and the DNS
            steps for your own domain at Cloudflare, GoDaddy, Namecheap and others.
          </Li>
          <Li>
            <A href="/docs/agency/embeds">Embed links</A> — share a read-only dashboard with a client.
          </Li>
          <Li>
            <A href="/docs/agency/usage-and-limits">Usage &amp; limits</A> — what the plan includes and
            what happens when you go past it.
          </Li>
          <Li>
            <A href="/docs/agency/client-sign-in">Client sign-in</A> — coming soon.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="For developers">
        <Ul>
          <Li>
            <A href="/docs/agency/api">Agency API</A> — a quick start, authentication, errors, idempotency
            and rate limits.
          </Li>
          <Li>
            <A href="/docs/agency/api/reference">API reference</A> — every endpoint, with its fields and
            curl and Node examples.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="What’s live and what’s next">
        <Ul>
          <Li>
            <B>Live now:</B> clients and websites, install checks, the overview, white-label settings,
            connecting and verifying your own domain, embed links, usage and the agency API.
          </Li>
          <Li>
            <B>Coming soon:</B> client sign-in to their own dashboard (by email link), with the page
            choices you make per client; serving client dashboards on your own domain; and usage limits
            per client with alerts.
          </Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
