import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Uptime monitoring · Seentics docs',
  description: 'Monitors, heartbeats, incidents, alerts, on-call and public status pages.',
};

export default function UptimePage() {
  return (
    <DocPage
      eyebrow="Products"
      title="Uptime monitoring"
      lead="Know your site is down before your customers tell you. Check it from outside, page the right person, and keep a public status page that updates itself."
    >
      <DocSection title="Where it lives">
        <P>
          Uptime runs at <C>uptime.seentics.com</C> with your Seentics account and team. Monitors,
          alert contacts, on-call schedules and status pages are managed there.
        </P>
      </DocSection>

      <DocSection title="Monitor types">
        <RefTable
          columns={['Type', 'What is checked']}
          rows={[
            ['HTTP(S)', 'A URL answers with an expected status code (2xx by default). Choose the method, headers, body, redirects and whether to accept an invalid certificate.'],
            ['Keyword', 'A page’s response contains — or does not contain — a word or phrase.'],
            ['Ping', 'A host answers ICMP ping.'],
            ['Port', 'A TCP port accepts connections (a database, a mail server, a game server).'],
            ['Heartbeat', 'The other way round: your job calls us. Silence past its interval plus a grace period is the failure.'],
          ]}
        />
        <P>
          Probes run every <C>30 seconds</C> or every <C>1</C> to <C>1,440</C> minutes. For HTTPS
          monitors the certificate&apos;s expiry and issuer are read on every check, even when the
          check fails.
        </P>
      </DocSection>

      <DocSection title="Heartbeats for cron jobs and workers">
        <P>
          A heartbeat monitor gives you a URL. Call it at the end of each successful run — a GET or
          a POST — and Uptime alerts when a run does not arrive on time. Intervals go up to a week.
        </P>
        <CodeBlock
          language="bash"
          code={`# at the end of your nightly backup
pg_dump mydb > backup.sql && curl -fsS https://api.seentics.com/api/v1/uptime/ping/<token>`}
        />
      </DocSection>

      <DocSection title="Up, degraded, down">
        <Ul>
          <Li><strong className="font-medium text-foreground">Up</strong> — the check passed.</Li>
          <Li>
            <strong className="font-medium text-foreground">Degraded</strong> — it passed, but slower
            than the response-time threshold you set. Shown, never paged: slow is not an outage.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Down</strong> — it failed. An incident
            opens on the change to down and closes on the change back to up, so a long outage is one
            incident and one alert, not one per check.
          </Li>
        </Ul>
        <P>Uptime is reported over the last 24 hours, 7, 30 and 90 days.</P>
      </DocSection>

      <DocSection title="Alerts and on-call">
        <P>
          Send alerts to email, SMS, Slack, Discord, PagerDuty, Opsgenie or a webhook. For a team,
          an on-call schedule says who holds the pager right now and an escalation policy says who
          is told next, and after how long, when nobody acknowledges.
        </P>
        <Callout kind="tip" title="Planned work does not page anyone">
          A maintenance window (one-off, daily or weekly) silences alerts for its monitors. Checks
          keep running and are kept in the history, so your uptime figure stays honest, and the
          status page shows the maintenance.
        </Callout>
      </DocSection>

      <DocSection title="Status pages">
        <P>
          Publish a public status page with the monitors you choose. Visitors can subscribe to be
          emailed when it changes — subscriptions are confirmed by email first, and every message
          carries an unsubscribe link.
        </P>
      </DocSection>

      <DocSection title="API keys">
        <P>
          Manage monitors from scripts and CI with a team API key (<C>supk_…</C>). A key carries a
          team role and is allowed exactly what that role allows. It is shown once and stored only
          as a hash — a lost key is replaced, not recovered.
        </P>
      </DocSection>
    </DocPage>
  );
}
