import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Li, P, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Billing & plans · Seentics docs',
  description: 'What counts against your limits, what happens when you reach them, and how to change plan.',
};

/**
 * Deliberately carries no price or limit numbers.
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
      <DocSection title="Where the numbers are">
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
        <P>
          Collection does not stop the moment you cross a threshold, and you are never billed for
          overage without choosing to upgrade. <C>Settings → Billing</C> shows usage against each
          limit as the month runs, so there is warning before it matters.
        </P>
      </DocSection>

      <DocSection title="Changing plan">
        <Ul>
          <Li>Upgrade from <C>Settings → Billing</C>; it takes effect immediately.</Li>
          <Li>Downgrades apply at the end of the current period.</Li>
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
