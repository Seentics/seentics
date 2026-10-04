import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Endpoint, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

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
      <DocSection title="Consent">
        <P>
          The tracker never touches <C>document.cookie</C>. What it does before and after a
          visitor consents depends on the website&apos;s consent mode, set in{' '}
          <C>Settings → Privacy</C>:
        </P>
        <RefTable
          columns={['Mode', 'Before consent', 'After consent']}
          rows={[
            [
              <><C>cookieless</C> (default)</>,
              'Page views, events, funnels and errors are counted under a daily anonymous id. Nothing is stored in the browser; recordings, heatmaps, automations and identify() do not run.',
              'Everything the site has switched on, under a visitor id kept in localStorage.',
            ],
            [<C key="s">strict</C>, 'Nothing is sent at all.', 'Everything the site has switched on.'],
            [
              <C key="n">none</C>,
              'No consent is asked: everything runs for every visitor. For sites outside the EU, or with another legal basis.',
              '—',
            ],
          ]}
        />
        <P>
          The anonymous id is a hash of the visitor&apos;s IP address and browser with a salt that
          changes every day and is then destroyed, so a visitor cannot be followed from one day to
          the next — or identified at all once the day is over.
        </P>
        <P>Tell the tracker about consent from your cookie banner, whenever the visitor decides:</P>
        <CodeBlock
          language="js"
          code={`// The visitor accepted analytics: identified features start at once, no reload.
seentics.consent(true);

// The visitor declined or withdrew: recording stops and every
// Seentics id in their browser is removed.
seentics.consent(false);`}
        />
        <P>
          When consent is already known before the tracker loads — your banner remembered an
          earlier choice — set <C>window.seenticsConsent = true</C> before the script tag, or add{' '}
          <C>data-consent=&quot;granted&quot;</C> to it. The tracker also remembers the last choice
          made through <C>seentics.consent()</C> itself.
        </P>
        <P>
          For a cookie banner&apos;s inventory: after consent the tracker stores <C>snc_vid</C>{' '}
          (visitor id), <C>snc_sid</C>, <C>snc_se</C> and <C>snc_ss</C> (session), <C>snc_rd</C>{' '}
          (recording sample decision) and <C>snc_cfg:*</C> (the site&apos;s settings, so the next
          page starts faster) in <C>localStorage</C>, and <C>snc_fs:*</C> (funnel progress) and{' '}
          <C>snc_hmshot:*</C> (heatmap snapshot sent) in <C>sessionStorage</C>. <C>snc_consent</C>{' '}
          records the visitor&apos;s choice itself. None is set before consent in the default mode.
        </P>
      </DocSection>

      <DocSection title="What is not collected">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">No IP storage.</strong> The address is
            used in memory to look up a coarse location (country, region, city) in a database on
            our own servers, and is never stored.
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
        <P>
          Whole pages can be masked too, in <C>Settings → Session replays → Text masking</C>: every
          word on them is replaced with asterisks of the same length, in recordings and heatmap
          snapshots alike, so layout and clicks still show. Either all pages, or those matching a
          list of patterns — by default the ones that usually show a visitor&apos;s own details:{' '}
          <C>/account</C>, <C>/profile</C>, <C>/settings</C>, <C>/checkout</C>, <C>/billing</C> and{' '}
          <C>/orders</C>. It follows single-page-app navigation: route onto a masked page and the
          masking starts there.
        </P>
      </DocSection>

      <DocSection title="Turning features off">
        <P>
          Every feature has its own switch per website in <C>Settings → Features</C>: session
          recordings, heatmaps, funnels, automations and error tracking. A feature switched off is
          not loaded in your visitors&apos; browsers at all — its code is never downloaded and none
          of its listeners run — and anything that still arrives for it is dropped, not stored.
        </P>
        <P>
          Recordings and heatmaps also take page rules: an include list (only these pages) and an
          exclude list (never these pages), one URL pattern per line, such as <C>/checkout/*</C> or{' '}
          <C>/account/*</C>. Recordings can also be sampled; a visit is either recorded in full or
          not at all.
        </P>
      </DocSection>

      <DocSection title="Data subject requests">
        <P>
          When one of your visitors asks for their data, or for it to be erased, answer from{' '}
          <C>Settings → Privacy → Visitor data request</C>. Find them by their visitor id — what{' '}
          <C>seentics.visitorId</C> returns in their browser — or by the user id you passed to{' '}
          <C>identify()</C>. Export downloads everything held about them as JSON: their events,
          recordings, errors, profile and linked ids, and the automations that ran for them.
          Erase removes all of it, recording files included, at once.
        </P>
        <P>The same is available over the API:</P>
        <Endpoint method="GET" path="/api/v1/privacy/visitor/:website_id?visitor_id=…  (or ?user_id=…)">
          Everything held about the visitor, as JSON.
        </Endpoint>
        <Endpoint method="DELETE" path="/api/v1/privacy/visitor/:website_id?visitor_id=…  (or ?user_id=…)">
          Erases it, in every table and in object storage.
        </Endpoint>
        <P>
          Deleting a website erases everything it collected, in every product — its observability
          telemetry included. Deleting your account (<C>Profile → Delete account</C>) erases every
          website you own, and cancels your subscription.
          Encrypted backups expire within 30 days, after which no copy remains.
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
          <Link href="/dpa" className="text-primary hover:underline">Data processing agreement</Link> ·{' '}
          <Link href="/subprocessors" className="text-primary hover:underline">Subprocessors</Link> ·{' '}
          <Link href="/terms" className="text-primary hover:underline">Terms of service</Link>
        </P>
      </DocSection>
    </DocPage>
  );
}
