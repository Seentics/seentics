import Link from 'next/link';
import { C, Callout, CodeBlock, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Automations · Seentics docs',
  description: 'Triggers, conditions and actions that run in the visitor’s browser the moment something happens.',
};

/**
 * The trigger and action tables are transcribed from `TRIGGER_TYPES` and
 * `ACTION_TYPES` in `components/automations/AutomationBuilder.tsx`, and the flow
 * nodes from `nodeVisual`. If the builder gains a type, this page is wrong until it
 * is updated — which is why each table says where it comes from.
 */
export default function AutomationsPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Automations"
      lead="See a behaviour, act on it — in the page, while the visitor is still there."
    >
      <DocSection title="The shape of an automation">
        <P>
          A trigger starts it, conditions decide which way it goes, and actions do something. You
          build it on a canvas by dragging nodes and connecting handles; branches can rejoin, so two
          paths can end at the same action and it runs once either way.
        </P>
        <P>
          Everything runs in the visitor&apos;s browser, which is what makes an exit-intent popup
          possible at all — there is no round trip to wait for.
        </P>
      </DocSection>

      <DocSection title="Triggers">
        <P>Thirteen, all evaluated client-side.</P>
        <RefTable
          columns={['Trigger', 'Fires when']}
          rows={[
            [<C>Page View</C>, 'A visitor lands on a page you specify.'],
            [<C>Click</C>, 'A visitor clicks an element you select.'],
            [<C>Scroll Depth</C>, 'A visitor scrolls past a depth.'],
            [<C>Time on Page</C>, 'A visitor has been on the page for a set time.'],
            [<C>Exit Intent</C>, 'The cursor moves as though leaving the page.'],
            [<C>Inactivity</C>, 'No interaction for a set period.'],
            [<C>Rage Click</C>, 'Repeated rapid clicks in one spot.'],
            [<C>Form Abandonment</C>, 'A form is started and left unsubmitted.'],
            [<C>JS Error</C>, 'A JavaScript error fires.'],
            [<C>Tab Hidden</C>, 'The tab is backgrounded.'],
            [<C>Tab Visible</C>, 'The tab is brought back.'],
            [<C>Custom Event</C>, <span>You call <C>seentics.track()</C> with a matching name.</span>],
            [<C>Identify</C>, <span>You call <C>seentics.identify()</C>.</span>],
          ]}
        />
      </DocSection>

      <DocSection title="Flow control">
        <RefTable
          columns={['Node', 'Does']}
          rows={[
            [<C>If / else</C>, 'Splits on a set of rules. Two outlets, Yes and No.'],
            [<C>Switch</C>, 'Several cases, first match wins, plus an “otherwise” outlet.'],
            [<C>Wait until</C>, 'Holds until its rules pass, or until a timeout you set.'],
            [<C>Delay</C>, 'Pauses before the next on-page action.'],
          ]}
        />
      </DocSection>

      <DocSection title="Actions">
        <P>Nine. Seven happen in the page; two leave it.</P>
        <RefTable
          columns={['Action', 'Does']}
          rows={[
            [<C>Show Modal</C>, 'A popup with a title, body and optional button.'],
            [<C>Show Toast</C>, 'A small notification, positioned and timed.'],
            [<C>Show Banner</C>, 'A full-width banner, top or bottom.'],
            [<C>Show Tooltip</C>, 'A tooltip attached to any element.'],
            [<C>Highlight Element</C>, 'Draws attention to an element, optionally scrolling it into view.'],
            [<C>Personalize Content</C>, 'Swaps the text or HTML of an element.'],
            [<C>Redirect</C>, 'Sends the visitor to another URL.'],
            [<C>Tag Session</C>, 'Labels the session so you can filter on it later.'],
            [<C>Webhook</C>, 'POSTs to an endpoint you choose — Slack, your own API, anything.'],
          ]}
        />
        <Callout kind="note" title="Tag Session is quieter than it looks">
          It changes nothing the visitor can see, but it makes “sessions where X happened” a filter
          in replays. Useful as a branch of a larger automation.
        </Callout>
      </DocSection>

      <DocSection title="Keeping it from becoming annoying">
        <Ul>
          <Li>
            <strong className="font-medium text-foreground">Frequency caps</strong> — how often a
            visitor may see this automation at all.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Cooldowns</strong> — a minimum gap
            between firings.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">Priority</strong> — which automation
            wins when two could fire at once.
          </Li>
          <Li>
            <strong className="font-medium text-foreground">A/B variants</strong> — split traffic
            between versions and compare.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Firing one from your own code">
        <P>
          A custom event trigger is the general-purpose hook. The same call also records the event
          and advances any matching{' '}
          <Link href="/docs/funnels" className="text-primary hover:underline">funnel</Link> step.
        </P>
        <CodeBlock
          language="js"
          filename="cart.js"
          code={`// Records the event, advances the funnel, and fires any
// automation with a Custom Event trigger for this name.
seentics.track('cart_abandoned', { value: 168 });`}
        />
      </DocSection>

      <DocSection title="Checking it works">
        <P>
          The automations list shows runs and a success rate per automation, so a webhook that
          started failing is visible without opening it. An automation with no runs has either never
          been triggered or is paused.
        </P>
      </DocSection>
    </DocPage>
  );
}
