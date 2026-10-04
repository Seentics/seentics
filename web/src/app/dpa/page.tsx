import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalTable } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Data Processing Agreement — Seentics',
  description: 'The terms under which Seentics processes personal data on behalf of its customers (GDPR Art. 28).',
};

export default function DpaPage() {
  return (
    <LegalPage
      title="Data Processing Agreement"
      current="/dpa"
      updated="1 October 2026"
      intro={
        <>
          <p>
            The terms under which Seentics (&ldquo;we&rdquo;, the <strong>processor</strong>) processes personal data on
            behalf of a customer (&ldquo;you&rdquo;, the <strong>controller</strong>), as Article 28 of the GDPR
            requires.
          </p>
          <p className="mt-3 text-sm">
            It forms part of our <Link href="/terms">Terms of Service</Link> and applies automatically whenever you use
            Seentics to process personal data; no signature is needed. For a countersigned copy, email{' '}
            <a href="mailto:privacy@seentics.com">privacy@seentics.com</a>.
          </p>
        </>
      }
    >
      <section>
        <h2>1. Scope</h2>
        <p>
          This agreement covers the personal data Seentics processes for you when you use it on your websites and
          applications: visitor analytics, session recordings, heatmaps, funnels, automations, error tracking,
          and observability telemetry (&ldquo;Customer Personal Data&rdquo;).
          The details — subject matter, purpose, data and data subjects — are in Annex 1. It lasts as long as we process
          Customer Personal Data for you.
        </p>
      </section>

      <section>
        <h2>2. Your instructions</h2>
        <p>
          We process Customer Personal Data only on your documented instructions: this agreement, the Terms of Service,
          and the settings you choose in Seentics — which features are on, on which pages, for how long data is kept.
          We do not process it for any purpose of our own. If we believe an instruction breaks data protection law, we
          will tell you. If the law requires us to process Customer Personal Data otherwise, we will tell you first,
          unless the law forbids it.
        </p>
      </section>

      <section>
        <h2>3. Your responsibilities</h2>
        <p>
          You are responsible for the lawfulness of the processing you instruct: having a legal basis for it, informing
          your visitors in your own privacy notice, and obtaining consent where it is required. Seentics gives you the
          means — by default it does not identify a visitor, store anything in their browser, or record their session
          until you call <code>seentics.consent(true)</code> — but whether and when consent is given is yours to manage.
        </p>
      </section>

      <section>
        <h2>4. Confidentiality</h2>
        <p>
          Everyone at Seentics who can access Customer Personal Data is bound by confidentiality, and has access only as
          far as their work requires.
        </p>
      </section>

      <section>
        <h2>5. Security</h2>
        <p>
          We maintain the technical and organisational measures in Annex 2, appropriate to the risk as Article 32
          requires. We may improve them over time, but never reduce the overall level of protection.
        </p>
      </section>

      <section>
        <h2>6. Subprocessors</h2>
        <p>
          You authorise us to engage the subprocessors on our <Link href="/subprocessors">subprocessors page</Link>. We
          bind each by written contract to obligations at least as protective as these, and remain responsible to you for
          their performance. We will tell you by email at least 30 days before a new subprocessor starts processing
          Customer Personal Data. You may object on reasonable data protection grounds; if we cannot resolve the
          objection, you may terminate the affected service and receive a refund of any prepaid fees for it.
        </p>
      </section>

      <section>
        <h2>7. International transfers</h2>
        <p>
          Customer Personal Data is stored in the European Union. Where a subprocessor processes it outside the European
          Economic Area, the transfer relies on an adequacy decision or on the European Commission&apos;s Standard
          Contractual Clauses (Module 3, processor to processor), which are incorporated by reference.
        </p>
      </section>

      <section>
        <h2>8. Data subjects&apos; rights</h2>
        <p>
          Seentics gives you the tools to answer your visitors&apos; requests yourself: export or erase everything held
          about one visitor, found by their visitor id or by the user id you identified them with; erase a whole
          website&apos;s data; switch any feature off. If a visitor contacts us directly, we will pass the request to
          you without undue delay and not answer it ourselves unless you ask us to. We will help with anything the tools
          do not cover.
        </p>
      </section>

      <section>
        <h2>9. Personal data breaches</h2>
        <p>
          We will notify you without undue delay, and in any case within 48 hours, after becoming aware of a personal
          data breach affecting Customer Personal Data. We will tell you what we know — its nature, the data and people
          likely affected, its likely consequences, and what we are doing about it — and keep you informed as we learn
          more, so you can meet your own obligations to notify.
        </p>
      </section>

      <section>
        <h2>10. Other assistance</h2>
        <p>
          We will give you the information you reasonably need for data protection impact assessments and prior
          consultations with a supervisory authority, as far as they concern our processing.
        </p>
      </section>

      <section>
        <h2>11. Deletion at the end</h2>
        <p>
          You can delete Customer Personal Data at any time: a website&apos;s data by deleting the website, all of it by
          deleting your account. Either takes effect at once, in every product. Encrypted backups expire within 30 days,
          after which no copy remains, unless the law requires us to keep it. Before deleting, you can export your data
          from the dashboard.
        </p>
      </section>

      <section>
        <h2>12. Audits</h2>
        <p>
          We will make available the information needed to demonstrate compliance with this agreement and answer your
          reasonable questions in writing. Where that is not enough, we will allow an audit by you or an independent
          auditor bound by confidentiality, on 30 days&apos; notice, during business hours, at most once a year unless a
          breach or a supervisory authority requires otherwise, and at your cost.
        </p>
      </section>

      <section>
        <h2>13. Liability and precedence</h2>
        <p>
          Liability under this agreement is governed by the Terms of Service. If this agreement and the Terms of Service
          conflict on the processing of personal data, this agreement prevails; if the Standard Contractual Clauses apply
          and conflict with either, the Clauses prevail.
        </p>
      </section>

      <section>
        <h2>Annex 1 — Details of the processing</h2>
        <LegalTable>
          <tbody>
            <tr>
              <th>Subject matter and purpose</th>
              <td>Providing Seentics to you: measuring and analysing how visitors use your websites and applications, replaying sessions, mapping interactions, running automations, tracking errors, and collecting observability telemetry.</td>
            </tr>
            <tr>
              <th>Nature</th>
              <td>Collection, storage, aggregation, analysis, display to you, export and erasure.</td>
            </tr>
            <tr>
              <th>Data subjects</th>
              <td>Visitors to and users of your websites and applications; people who subscribe to your status pages; your alert contacts.</td>
            </tr>
            <tr>
              <th>Personal data</th>
              <td>
                Pseudonymous visitor and session identifiers; pages visited, referrers, events and their properties;
                coarse location (country, region, city) and device, browser and operating system; session recordings
                and page snapshots, with typed input and text you choose masked; error messages and stack traces;
                telemetry your applications send; user ids and traits you send with <code>identify</code>; status-page
                subscriber email addresses and alert contact details. IP addresses are used in memory for location and
                anonymous counting and are not stored.
              </td>
            </tr>
            <tr>
              <th>Special categories</th>
              <td>None are intended. You must not send them, and must mask any page that shows them.</td>
            </tr>
            <tr>
              <th>Duration and retention</th>
              <td>For the term of your subscription; each kind of data for the retention period of your plan, then deleted automatically.</td>
            </tr>
          </tbody>
        </LegalTable>
      </section>

      <section>
        <h2>Annex 2 — Technical and organisational measures</h2>
        <h3>Minimisation and pseudonymisation</h3>
        <ul>
          <li>Anonymous until consent by default: no browser storage, and a daily identifier from a salt destroyed after the day, so visits cannot be linked across days.</li>
          <li>IP addresses never stored. Typed input, editable regions and marked elements masked in the browser before anything is sent; all text masked on pages you choose.</li>
          <li>Every feature can be switched off or limited to chosen pages; a switched-off feature is not loaded in the visitor&apos;s browser.</li>
          <li>AI Mode sends its model provider aggregate figures only, with identifiers removed.</li>
        </ul>
        <h3>Confidentiality and integrity</h3>
        <ul>
          <li>TLS for all traffic. Recordings readable only through short-lived signed links.</li>
          <li>Role-based team permissions checked on every request; API keys scoped to one team and revocable.</li>
          <li>Passwords stored as salted bcrypt hashes; sessions revocable, and ended everywhere on a password change.</li>
          <li>Rate limits on sign-in and other sensitive endpoints.</li>
        </ul>
        <h3>Availability and resilience</h3>
        <ul>
          <li>Daily database backups, encrypted with a key held off the servers, stored separately with their own credentials, and expired after 30 days.</li>
          <li>Health checks and monitoring of every service.</li>
        </ul>
        <h3>Erasure</h3>
        <ul>
          <li>Automatic deletion at the end of each retention period.</li>
          <li>Per-visitor export and erasure, website erasure and account erasure, each immediate and across every product.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
