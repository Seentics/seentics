import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Endpoint, Li, P, Ul } from '@/components/docs/DocsKit';

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
            <strong className="font-medium text-foreground">No typed input.</strong> Every input is
            masked in recordings, always — it is not a setting that can be turned off.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">No cross-site tracking.</strong> A
            visitor ID is per site. There is no shared identity graph between the sites you track,
            or between customers.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Keeping things out of recordings">
        <P>
          Beyond input masking, mark elements you do not want captured. Both attributes are read
          from the DOM by the recorder:
        </P>
        <Ul>
          <Li>
            <C>data-seentics-block</C> — replaced by a placeholder; contents never captured.
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
          Export and deletion are available from <C>Settings → Privacy</C> and over the API, so you
          can wire them into your own request process.
        </P>
        <Endpoint method="POST" path="/api/v1/privacy/export">
          Returns the data held for a visitor.
        </Endpoint>
        <Endpoint method="POST" path="/api/v1/privacy/delete">
          Removes the data held for a visitor.
        </Endpoint>
        <P>
          Both need an <Link href="/docs/api-keys" className="text-primary hover:underline">API key</Link>.
          The exact request shape is in the catalogue described on the{' '}
          <Link href="/docs/api" className="text-primary hover:underline">REST API</Link> page.
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
