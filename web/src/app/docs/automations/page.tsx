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

      <DocSection title="Collecting emails with a form">
        <P>
          Turn on <C>Collect emails with a form</C> in a modal action and the button is replaced by a
          form: an email field, up to seven more (text or phone), a thank-you message, and an
          optional consent checkbox. Submissions land in the <C>Leads</C> inbox, where you can search,
          mark a contact as contacted or archived, export a CSV, or delete a contact and everything
          they sent.
        </P>
        <Ul>
          <Li>
            Each submission records the popup, the A/B variant and the page it came from, so you can
            see which message produced a lead.
          </Li>
          <Li>
            A repeat submission from the same email updates the one contact instead of adding a
            second row.
          </Li>
          <Li>
            A successful submit records a <C>lead_captured</C> custom event, so you can build a goal
            or a funnel step on it.
          </Li>
          <Li>
            Bots are filtered with a hidden honeypot field and a per-visitor rate limit; nothing is
            stored for a submission that trips either.
          </Li>
        </Ul>
        <Callout>
          Leads are personal data you collect from your visitors. Ask for consent where your
          jurisdiction requires it, using the consent checkbox, and delete contacts on request.
        </Callout>
      </DocSection>

      <DocSection title="Popup types, prizes and coupons">
        <P>
          A modal's <C>Popup type</C> chooses its layout, and a bar can carry the same mechanics. The
          builder shows a live preview that runs the same code as your site, so what you see is what
          visitors get. Nothing you submit in the preview is sent or stored.
        </P>
        <RefTable
          columns={['Type', 'What it does']}
          rows={[
            [<C>Spin to win</C>, 'A prize wheel unlocked by an email. Each slice has a label, a relative weight and an optional coupon code; a slice with no code is a “try again”.'],
            [<C>Multi-step</C>, 'One to five one-tap questions, then the email. Answers are stored on the lead under each question’s name.'],
            [<C>Countdown</C>, 'A timer: per visitor (starts the first time they see it) or counting to a fixed date. It can close the popup or show a message when it ends.'],
            [<C>Teaser tab</C>, 'Shows a small tab on the page edge that opens the popup when clicked, instead of covering the page.'],
            [<C>Sticky bar</C>, 'A banner pinned to the top or bottom with an inline email form, and optionally a countdown or coupon.'],
            [<C>Coupon</C>, 'A code shown in the popup. Behind an email form it is revealed only after the email is submitted.'],
          ]}
        />
        <Ul>
          <Li>
            The wheel’s prize is chosen on the server, by weight, when the email is submitted — never
            in the visitor’s browser. Coupon codes are removed from the copy of the popup sent to the
            page and arrive only with the prize, so they cannot be read ahead of time.
          </Li>
          <Li>
            Each email wins once per popup: submitting the same address again returns the prize it
            already won rather than spinning again. It does not stop a visitor using several
            addresses, so treat a prize as a marketing incentive, not a secured entitlement.
          </Li>
          <Li>
            Teaser tabs, countdowns and coupons combine with any popup type. A wheel and a multi-step
            popup both need the email form, which the builder switches on for you.
          </Li>
          <Li>
            Animations stop for visitors who prefer reduced motion, popups can be closed with Escape,
            and the dialog keeps keyboard focus inside while it is open.
          </Li>
        </Ul>
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
