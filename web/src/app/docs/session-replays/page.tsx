import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Session replays · Seentics docs',
  description: 'Watch real sessions with the console, network log and JavaScript errors on one timeline.',
};

/**
 * A new route: session replays existed only as an anchor section on the old index
 * page, with no page of its own despite being in the sidebar.
 */
export default function SessionReplaysPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Session replays"
      lead="A drop-off is a question. The recording is the answer."
    >
      <DocSection title="What a replay is">
        <P>
          Not a video. Seentics records the DOM — the structure of the page and every change to it —
          and replays it in the browser. That means text stays selectable, the recording stays sharp
          at any size, and a session costs a fraction of what video would.
        </P>
      </DocSection>

      <DocSection title="Turning it on">
        <P>
          Recording is off until you enable it for a site in <C>Settings → Features</C>. Until then
          the recorder is never downloaded — it is a separate ~56&nbsp;KB file that only loads once
          recording is on and the visitor is sampled in.
        </P>
        <Callout kind="tip" title="It costs nothing while it is off">
          The 11&nbsp;KB tracker contains no recorder. Leaving replays disabled has no effect on page
          weight at all.
        </Callout>
      </DocSection>

      <DocSection title="What you see alongside the player">
        <RefTable
          columns={['Tab', 'Contents']}
          rows={[
            ['Summary', 'Browser, device and OS, country, entry and exit page, when it started, how long it runs, pages viewed.'],
            ['Timeline', 'Events in order, with rage clicks and errors marked so you can jump straight to the moment.'],
            ['Errors', 'JavaScript errors and unhandled promise rejections that fired during the recording.'],
            ['Console', 'Console output captured as it happened.'],
            ['Network', 'Requests with method, status and timing.'],
          ]}
        />
        <P>
          They share one clock with the player, so pausing at the moment something broke shows you
          the console line and the failed request that go with it.
        </P>
      </DocSection>

      <DocSection title="Signals on the session list">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Rage clicks</strong> — three or more
            clicks within about a second inside roughly a 50&times;50&nbsp;px area. Usually something
            that looks clickable and is not.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Client errors</strong> — a JavaScript
            error or unhandled rejection fired while recording. Console warnings and failed requests
            do not set it.
          </Li>
        </Ul>
        <P>
          Both are filterable, so &ldquo;show me sessions that broke&rdquo; is one click rather than
          a hunt.
        </P>
      </DocSection>

      <DocSection title="Privacy">
        <P>
          Every input is masked — always, not as a setting. Typed values never leave the browser. For
          anything else you do not want captured, mark the element with{' '}
          <C>data-seentics-block</C>; see the{' '}
          <Link href="/docs/tracker" className="text-primary hover:underline">tracker reference</Link>{' '}
          for both element attributes.
        </P>
      </DocSection>

      <DocSection title="From a number to a session">
        <P>
          Replays are most useful arrived at from something else — a funnel step that loses people, a
          page with a strange bounce rate, a spike in errors. Start with{' '}
          <Link href="/docs/funnels" className="text-primary hover:underline">funnels</Link>, then
          watch the sessions behind the step.
        </P>
      </DocSection>
    </DocPage>
  );
}
