import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Notice — Seentics',
  description: 'What personal data Seentics processes, why, for how long, who else handles it, and your rights.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Notice"
      current="/privacy"
      updated="1 October 2026"
      intro={
        <p>
          What personal data Seentics processes, why, for how long, who else handles it, and the rights you have over it
          under the GDPR and similar laws.
        </p>
      }
    >
      <section>
        <h2>1. Two roles</h2>
        <p>
          Seentics processes personal data in two different capacities, and which one applies decides who answers for it.
        </p>
        <h3>Seentics as controller — your account</h3>
        <p>
          When you sign up for and use Seentics, we decide why and how your account data is processed. This notice
          covers that processing in full.
        </p>
        <h3>Seentics as processor — your visitors</h3>
        <p>
          When you install Seentics on your website or app, it collects data about <em>your</em> visitors on your
          behalf: page views, events, session recordings, heatmaps, errors, observability telemetry. For that data, you are the controller and we are your processor: we handle it only on your
          instructions, under our <Link href="/dpa">Data Processing Agreement</Link>. If you are a visitor to a website
          that uses Seentics, that website&apos;s owner is the one to ask about your data; we will help them answer you.
        </p>
      </section>

      <section>
        <h2>2. What we process about account holders</h2>
        <ul>
          <li><strong>Account:</strong> name, email address, a hash of your password (never the password), or the identity Google or GitHub returns if you sign in with them.</li>
          <li><strong>Teams:</strong> the teams you belong to, your role, and invitations you send or receive.</li>
          <li><strong>Billing:</strong> your plan and subscription status. Payment details are collected and held by our payment provider, Lemon Squeezy, not by us.</li>
          <li><strong>Configuration:</strong> the websites, monitors, alert contacts and settings you create.</li>
          <li><strong>Support:</strong> messages you send us.</li>
          <li><strong>Security and operations:</strong> sign-in events, IP addresses of requests to our API, and service logs, used to keep the service secure and working.</li>
          <li><strong>AI Mode:</strong> the questions you ask it.</li>
        </ul>
      </section>

      <section>
        <h2>3. Why, and on what legal basis</h2>
        <ul>
          <li><strong>To provide the service you signed up for</strong> — running your account, your dashboards and your alerts: performance of a contract (Art. 6(1)(b) GDPR).</li>
          <li><strong>To bill you</strong>, and keep the records tax law requires: performance of a contract and legal obligation (Art. 6(1)(b) and (c)).</li>
          <li><strong>To keep the service secure</strong> — preventing abuse, fraud and attacks, and investigating incidents: our legitimate interest in a secure service (Art. 6(1)(f)).</li>
          <li><strong>To tell you about the service</strong> — security notices, usage limits, changes to these terms: performance of a contract and legitimate interest.</li>
        </ul>
        <p>We do not sell personal data, use it for advertising, or train AI models on it.</p>
      </section>

      <section>
        <h2>4. Visitor data we process for our customers</h2>
        <p>
          How much a customer&apos;s installation collects is under their control: each feature — session recording,
          heatmaps, funnels, automations, error tracking — can be switched off, limited to certain pages, or sampled.
          By default the tracker:
        </p>
        <ul>
          <li>counts visits <strong>anonymously until the visitor consents</strong>: no cookie, nothing stored in the browser, and an identifier derived from a salt that changes every day and is then destroyed, so one day&apos;s visits cannot be linked to the next;</li>
          <li>records sessions and heatmaps <strong>only after consent</strong>, with everything typed into forms masked in the browser before it is sent, and all text masked on pages that usually show personal details (account, settings, checkout and the like);</li>
          <li>uses the visitor&apos;s IP address only in memory, to look up a coarse location (country, region, city) in a database on our own servers — the address itself is never stored.</li>
        </ul>
        <p>
          Customers can export or erase everything held about one visitor, and erase a whole website&apos;s data, at any
          time from their dashboard.
        </p>
      </section>

      <section>
        <h2>5. How long we keep it</h2>
        <ul>
          <li><strong>Account data:</strong> for as long as your account exists. Deleting your account erases it, with every website, recording, monitor and setting in it, at once.</li>
          <li><strong>Visitor data:</strong> for the retention period of the customer&apos;s plan, after which it is deleted automatically, or sooner when the customer deletes it.</li>
          <li><strong>Backups:</strong> encrypted, and kept for 30 days. Data you delete leaves the backups when they expire.</li>
          <li><strong>Billing records:</strong> kept by Lemon Squeezy for as long as tax law requires.</li>
        </ul>
      </section>

      <section>
        <h2>6. Who else handles it</h2>
        <p>
          Our servers are in the European Union. A small number of service providers process data for us — hosting,
          storage, email, SMS alerts and payments. Each is bound by a data processing agreement, and the full list,
          with what each one does and where, is on our <Link href="/subprocessors">subprocessors page</Link>.
        </p>
        <p>
          Where a provider is outside the European Economic Area, transfers rely on an adequacy decision (such as the
          EU–US Data Privacy Framework) or the European Commission&apos;s Standard Contractual Clauses.
        </p>
      </section>

      <section>
        <h2>7. Security</h2>
        <ul>
          <li>All traffic to and from Seentics is encrypted in transit (TLS).</li>
          <li>Backups are encrypted with a key that is not stored on our servers.</li>
          <li>Passwords are stored only as salted hashes; sessions can be revoked, and changing your password ends every other session.</li>
          <li>Access to customer data is limited to what running the service requires, and every dashboard request is checked against the team permissions you set.</li>
        </ul>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>
          You can ask us for a copy of your data, to correct it, to delete it, to restrict or object to how we process
          it, and to receive it in a portable format. Much of this you can do yourself: change your details in your
          profile, export your data from the privacy settings, and delete your account under Profile → Delete account.
        </p>
        <p>
          For anything else, email <a href="mailto:privacy@seentics.com">privacy@seentics.com</a>. We answer within one
          month. You also have the right to complain to a data protection supervisory authority, in particular the one
          where you live or work.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions about this notice or your data: <a href="mailto:privacy@seentics.com">privacy@seentics.com</a>.
        </p>
        <p>
          When this notice changes in a way that matters, we tell account holders by email before the change takes
          effect.
        </p>
      </section>
    </LegalPage>
  );
}
