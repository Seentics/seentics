import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Billing & plans · Seentics docs',
  description: 'What counts against your limits, what happens when you reach them, and how to change plan.',
};

/**
 * Deliberately carries no plan prices or limits (the extra usage rates are the exception).
 * Observability is not covered here while it isn't marketed; its docs stay at /docs/observability.
 *
 * They live in `components/subscription/PlanBuilder`, which renders on /pricing and
 * in billing settings. A third copy in prose would be a third thing to update, and
 * the one most likely to be forgotten.
 */
export default function BillingPage() {
  return (
    <DocPage
      eyebrow="Platform"
      title="Billing & plans"
      lead="What counts against a limit, and what happens when you reach one."
    >
      <DocSection title="The plans">
        <Ul>
          <Li><strong>Free</strong>: the whole product at small amounts, with no card.</Li>
          <Li><strong>Starter</strong>: the whole product for one growing business, stopping at its limits.</Li>
          <Li><strong>Pro</strong>: more of everything for one business, with optional extra usage past its included amounts.</Li>
          <Li>
            <strong>Agency</strong>: for agencies managing sites for clients. The largest allowances, extra
            usage, and the agency features — client workspaces, adding websites to clients, embedded
            dashboards — which the other plans don&apos;t include. Clients and embed links you made before
            keep working on any plan; only creating new ones needs Agency.
          </Li>
        </Ul>
        <P>
          Current plans, prices and limits are on the{' '}
          <Link href="/pricing" className="font-medium text-primary hover:underline">pricing page</Link>,
          and your own usage against them is in <C>Settings → Billing</C>. They are not repeated here
          on purpose — a copy in documentation is a copy that goes stale.
        </P>
      </DocSection>

      <DocSection title="What counts as an event">
        <P>
          Every pageview is an event, and so is every custom event you send with{' '}
          <C>seentics.track()</C>. That is the figure your monthly allowance is measured against.
        </P>
        <Ul>
          <Li>A single-page app route change counts as a pageview, because it is one.</Li>
          <Li>
            Session recordings are counted separately, as recordings — not as events.
          </Li>
          <Li>
            AI questions have their own monthly allowance, counted per question asked.
          </Li>
        </Ul>
        <Callout kind="tip" title="If events are climbing faster than traffic">
          A <C>seentics.track()</C> call inside a component that re-renders is the usual cause. The
          Custom Events page shows counts per event name, which makes the culprit obvious.
        </Callout>
      </DocSection>

      <DocSection title="Reaching a limit">
        <Ul>
          <Li>
            On Free, collection of that kind of data pauses until the next month. Nothing is billed,
            and everything collected so far is kept.
          </Li>
          <Li>
            On Starter, the same happens: its limits are plain, with no extra usage. Move to Pro or Agency
            if you outgrow it.
          </Li>
          <Li>
            On Pro and Agency, the same happens, unless you turn on extra usage in <C>Settings → Billing</C>.
            Then usage past what the plan includes keeps being collected and is billed at the end of the
            month: $0.01 per 1K events and $2 per 1K session recordings. Extra usage under $1 in a month is
            not billed.
          </Li>
          <Li>
            A monthly spend cap on extra usage, also in <C>Settings → Billing</C>, bounds that charge: at
            the cap, usage past what is included pauses until the next period, and you are never charged
            more. You can turn extra usage off at any time.
          </Li>
        </Ul>
        <P>
          <C>Settings → Billing</C> shows usage against each limit as the month runs, and you are
          emailed at 80% and 100%.
        </P>
      </DocSection>

      <DocSection title="Changing plan">
        <Ul>
          <Li>Upgrade from <C>Settings → Billing</C>; it takes effect immediately.</Li>
          <Li>
            Every paid plan is billed monthly or yearly; yearly costs ten months, so two are free. Switch
            to yearly, or move between Starter, Pro and Agency, from <C>Settings → Billing</C>: the new
            subscription replaces the old one, which stops renewing and runs to the end of the period you
            paid for.
          </Li>
          <Li>Cancelling your plan moves you to Free at the end of the current period, and turns extra usage off.</Li>
          <Li>Extra usage is always billed monthly, whichever way the plan is billed.</Li>
          <Li>
            Cancelling stops future charges. Your data stays until its retention period expires — see{' '}
            <Link href="/docs/privacy" className="text-primary hover:underline">Privacy &amp; security</Link>{' '}
            for exporting it first.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Self-hosting">
        <P>
          None of this applies if you run Seentics yourself. The platform is AGPL-3.0 and has no
          limits of its own — your infrastructure is the constraint. Billing exists only on the
          hosted service.
        </P>
      </DocSection>

      <DocSection title="Refunds">
        <P>
          See the{' '}
          <Link href="/refund-policy" className="text-primary hover:underline">refund policy</Link>.
        </P>
      </DocSection>
    </DocPage>
  );
}
