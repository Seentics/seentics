import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Privacy & security · Seentics docs',
  description: 'What Seentics stores, what it does not, and how to export or delete it.',
};

export default function PrivacyPage() {
  return (
    <DocPage
      eyebrow="Platform"
      title="Privacy & security"
      lead="What is stored, what is not, and how to get it out or remove it."
    >
      <DocSection title="No cookies">
        <P>
          The tracker never touches <C>document.cookie</C>. It does use browser storage: a visitor ID
          in <C>localStorage</C>, so a returning visitor is recognised, and <C>sessionStorage</C> for
          per-tab state such as funnel progress.
        </P>
        <Callout kind="warning" title="Storage is not the same as “no consent needed”">
          A persistent identifier in <C>localStorage</C> is generally treated like a cookie under
          ePrivacy and the GDPR, even though it is not one. &ldquo;Seentics sets no
          cookies&rdquo; is accurate and worth saying. Whether your site still needs a consent
          notice is a question for your own legal advice, not something these docs can answer.
        </Callout>
      </DocSection>

      <DocSection title="What is not collected">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">No IP storage.</strong> Country is
            resolved at ingest; the address is not kept with the event.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">No typed input.</strong> Form fields and
            rich-text editors (anything <C>contenteditable</C>) are masked in recordings, always —
            it is not a setting that can be turned off.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">No cross-site tracking.</strong> A
            visitor ID is per site. There is no shared identity graph between the sites you track,
            or between customers.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="What a recording does include">
        <P>
          A recording is more than the DOM. Alongside the replay itself, Seentics stores the
          annotations that make one worth watching — and it is worth knowing what those are before
          you enable recording on a page that handles personal data.
        </P>
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Console output.</strong> Calls to{' '}
            <C>console.log/info/warn/error/debug</C>, up to ten arguments each, truncated at
            1,000 characters.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Network requests.</strong> Method, URL,
            status and duration for every <C>fetch</C> and <C>XMLHttpRequest</C>. Request and
            response <em>bodies</em> are never read.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">JavaScript errors.</strong> Message,
            stack, file and line for uncaught errors and unhandled rejections.
          </Li>
        </Ul>
        <P>
          All three are scrubbed before they leave the browser. URL credentials and fragments are
          dropped; query values under keys that look sensitive (<C>token</C>, <C>password</C>,{' '}
          <C>api_key</C>, <C>email</C>, <C>otp</C>, and similar) are replaced with{' '}
          <C>redacted</C>; and anything shaped like an email address or a bearer token is removed
          from console arguments, error messages and stack traces wherever it appears.
        </P>
        <Callout kind="warning" title="Scrubbing is a safety net, not a guarantee">
          It matches patterns. It cannot know that your own <C>?ref=</C> parameter identifies a
          person, or that a log line prints a customer record. If a page handles data you would
          not want a teammate reading back, turn the sidecars off for the site or exclude the page.
        </Callout>
        <P>
          Both sidecars can be switched off on the tracker script tag, in which case the override
          is never installed at all — <C>console</C> and <C>fetch</C> are left untouched:
        </P>
        <Ul>
          <Li>
            <C>data-capture-console=&quot;off&quot;</C> — no console capture.
          </Li>
          <Li>
            <C>data-capture-network=&quot;off&quot;</C> — no request capture.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Keeping things out of recordings">
        <P>
          Beyond input masking, mark elements you do not want captured. All three attributes are
          read from the DOM by the recorder:
        </P>
        <Ul>
          <Li>
            <C>data-seentics-block</C> — replaced by a placeholder; contents never captured.
          </Li>
          <Li>
            <C>data-seentics-mask</C> — the element still renders and animates, but its text is
            replaced with asterisks. Use it where the layout matters and the words do not.
          </Li>
          <Li>
            <C>data-seentics-ignore</C> — captured once, then changes inside it are not tracked.
          </Li>
        </Ul>
        <P>
          See the{' '}
          <Link href="/docs/tracker" className="text-primary hover:underline">tracker reference</Link>{' '}
          for examples.
        </P>
      </DocSection>

      <DocSection title="Turning features off">
        <P>
          Session recording and heatmaps are off until enabled per site in{' '}
          <C>Settings → Features</C>. While recording is off the recorder file is never downloaded,
          so nothing about a visitor&apos;s session is captured at all.
        </P>
      </DocSection>

      <DocSection title="Data subject requests">
        <P>
          <strong>Per-visitor export and erasure are not available yet.</strong> The{' '}
          <C>/api/v1/privacy/*</C> paths are reserved and currently answer{' '}
          <C>501 Not Implemented</C>. This page previously described them as working; they
          were never wired up, and the endpoints returned empty success responses.
        </P>
        <P>
          What you can do today: deleting a website from <C>Settings</C> removes its
          analytics events, session recordings, heatmap points, funnels and automations.
          Retention also runs automatically and drops data past your plan&apos;s cutoff — see
          below.
        </P>
        <P>
          If you need to answer a data subject request before per-visitor tooling ships,
          contact support and we will run the erasure directly.
        </P>
      </DocSection>

      <DocSection title="Retention">
        <P>
          How long data is kept depends on your plan; the figure is on the{' '}
          <Link href="/pricing" className="text-primary hover:underline">pricing page</Link>. Older
          data is removed automatically once it passes that window.
        </P>
      </DocSection>

      <DocSection title="Self-hosting">
        <P>
          The strongest privacy answer is that the data never leaves your infrastructure. Point the
          tracker at your own host with <C>data-api-host</C> and no third party is involved at all.
        </P>
      </DocSection>

      <DocSection title="Our own policies">
        <P>
          <Link href="/privacy" className="text-primary hover:underline">Privacy notice</Link> ·{' '}
          <Link href="/terms" className="text-primary hover:underline">Terms of service</Link>
        </P>
      </DocSection>
    </DocPage>
  );
}
