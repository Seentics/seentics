import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalTable } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Subprocessors — Seentics',
  description: 'The service providers that process personal data for Seentics, what each does, and where.',
};

/**
 * Every provider that processes personal data on our behalf. A new one is added here,
 * and account holders told, before it starts — the Data Processing Agreement promises
 * 30 days' notice.
 */
const SUBPROCESSORS: { name: string; purpose: string; data: string; location: string; transfer: string }[] = [
  {
    name: 'netcup GmbH',
    purpose: 'Hosting: the servers that run Seentics and its databases',
    data: 'All data the service holds',
    location: 'Germany',
    transfer: 'None — within the EU',
  },
  {
    name: 'Cloudflare, Inc.',
    purpose: 'Delivery of the website, dashboard and tracking script; object storage for session recordings, heatmap snapshots and backups (encrypted)',
    data: 'Visitor IP addresses in transit; recordings and snapshots at rest',
    location: 'Global network; storage in the EU',
    transfer: 'EU–US Data Privacy Framework; Standard Contractual Clauses',
  },
  {
    name: 'Amazon Web Services, Inc. (Amazon SES)',
    purpose: 'Transactional email: sign-up, password reset, alerts, reports',
    data: 'Recipient email addresses and the message',
    location: 'United States (N. Virginia region)',
    transfer: 'EU–US Data Privacy Framework; Standard Contractual Clauses',
  },
  {
    name: 'OpenAI, L.L.C.',
    purpose: 'AI Mode, only when a customer uses it: answers questions about their own analytics',
    data: 'The question, and aggregate figures with identifiers removed before they are sent — never visitor identifiers, IP addresses or recordings',
    location: 'United States',
    transfer: 'EU–US Data Privacy Framework; Standard Contractual Clauses',
  },
];

const INDEPENDENT: { name: string; role: string }[] = [
  {
    name: 'Lemon Squeezy, LLC',
    role: 'Our merchant of record. It sells Seentics subscriptions in its own name and processes payment and tax data as a controller under its own privacy policy.',
  },
  {
    name: 'Google LLC and GitHub, Inc.',
    role: 'Only if you choose to sign in with them: they confirm who you are and share your name and email address with us.',
  },
];

export default function SubprocessorsPage() {
  return (
    <LegalPage
      title="Subprocessors"
      current="/subprocessors"
      updated="1 October 2026"
      intro={
        <p>
          The service providers that process personal data on our behalf. Each is bound by a data processing agreement
          with obligations at least as protective as our <Link href="/dpa">Data Processing Agreement</Link> with you.
        </p>
      }
    >
      <section>
        <h2>Subprocessors</h2>
        <LegalTable>
          <thead>
            <tr>
              <th>Provider</th>
              <th>What it does</th>
              <th>Personal data</th>
              <th>Location</th>
              <th>Transfer safeguard</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name}>
                <td className="font-medium text-foreground whitespace-nowrap">{s.name}</td>
                <td>{s.purpose}</td>
                <td>{s.data}</td>
                <td>{s.location}</td>
                <td>{s.transfer}</td>
              </tr>
            ))}
          </tbody>
        </LegalTable>
      </section>

      <section>
        <h2>Not subprocessors</h2>
        <p>These handle personal data in connection with Seentics, but as independent controllers rather than for us:</p>
        <ul>
          {INDEPENDENT.map((p) => (
            <li key={p.name}><strong>{p.name}</strong> — {p.role}</li>
          ))}
        </ul>
        <p>
          Alert destinations you connect yourself — Slack, Discord, PagerDuty, Opsgenie, webhooks — receive what
          you send them on your instructions; they are your providers, not ours. Location lookups use a database on our
          own servers: no visitor IP address is sent to a third party for them.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We tell account holders by email at least 30 days before a new subprocessor starts processing their data, so
          they can object. Questions: <a href="mailto:privacy@seentics.com">privacy@seentics.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
