import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Integrations · Seentics docs',
  description: 'Send form submissions to Zapier, any webhook, Mailchimp, Klaviyo and HubSpot, with automatic retries and credentials encrypted at rest.',
};

/**
 * What each provider does is transcribed from `core/modules/integrations/providers/`, and the
 * delivery rules (retry schedule, pause, at-least-once) from `services/delivery-worker`. If either
 * changes, this page is wrong until it is updated.
 */
export default function IntegrationsPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Integrations"
      lead="Every form submission can be sent on to the tools you already use, or to your own backend."
    >
      <DocSection title="How it works">
        <P>
          Add a destination in <C>Settings → Integrations</C>. Each form (see{' '}
          <Link href="/docs/automations" className="text-primary hover:underline">Automations</Link>) then
          sends its submissions to every destination, or to the ones you pick under{' '}
          <C>Send submissions to</C> in the builder. You can add several destinations, including
          several webhooks, and give each a name. A submission is saved, queued for each destination
          and delivered in the background, so a slow or failing tool never delays the form a visitor
          is looking at.
        </P>
        <Ul>
          <Li>
            <strong>Verified before saving.</strong> Adding a destination makes a real, read-only
            call to the provider, so a wrong key, audience or missing permission is reported while
            you are looking at it.
          </Li>
          <Li>
            <strong>Automatic retries.</strong> A temporary failure (a timeout, HTTP 429 or a 5xx)
            is retried after 30 seconds, 2 minutes, 10 minutes, 1 hour and 6 hours, then marked
            failed. The queue is stored in the database, so a restart does not lose what is waiting.
            A rejected request (a 4xx) is not retried, since it would be rejected again.
          </Li>
          <Li>
            <strong>Retry by hand.</strong> A failed delivery shows a <C>Retry</C> button in the log
            and goes back in the queue.
          </Li>
          <Li>
            <strong>Automatic pause.</strong> A rejected credential pauses the destination at once,
            and five failed deliveries in a row pause it too. The card shows <C>Needs attention</C>{' '}
            and the last error. Submissions that arrive while it is paused wait for it; turn it back
            on, or edit the credentials, and they are sent.
          </Li>
          <Li>
            <strong>A delivery log.</strong> Each submission and destination appears under Recent
            deliveries as queued, retrying, delivered, skipped or failed, so <em>did it arrive?</em>{' '}
            always has an answer. The log ages out with your other history.
          </Li>
        </Ul>
        <Callout kind="note" title="At least once">
          A destination that was down gets the submission again later, and a network timeout can hide
          a success, so a webhook may receive the same submission twice. Every webhook request carries{' '}
          <C>Idempotency-Key</C> (the submission id) so you can skip repeats. Mailchimp, Klaviyo and
          HubSpot update by email address, so a repeat changes nothing.
        </Callout>
      </DocSection>

      <DocSection title="Providers">
        <RefTable
          columns={['Provider', 'What you give us', 'What happens to a submission']}
          rows={[
            [
              <C>Zapier / Webhook</C>,
              'The Catch Hook or endpoint URL, and optionally a signing secret.',
              <>Posts the submission as JSON (<C>event</C>, <C>submission_id</C>, <C>email</C>, <C>name</C>, <C>phone</C>, <C>consent</C>, <C>fields</C>, the <C>prize</C> a spin wheel or coupon gave, and the popup, variant and page it came from). With a secret, requests carry <C>X-Seentics-Signature: sha256=…</C>, an HMAC of the body. Always sent, with the consent flag in the payload.</>,
            ],
            [
              <C>Mailchimp</C>,
              'An API key (including the -us21 style suffix) and an Audience ID.',
              'Adds or updates the member. Only people who ticked the consent box are sent; others are skipped. Optional double opt-in.',
            ],
            [
              <C>Klaviyo</C>,
              'A private API key, and optionally a list ID.',
              'Creates or updates the profile for every submission. With a list: someone who consented is subscribed to email marketing on it; someone who did not is added as a plain member, with no consent recorded.',
            ],
            [
              <C>HubSpot</C>,
              'A private app access token.',
              'Creates the contact, or updates it if the email already exists. Sent whether or not the visitor consented, since it is a CRM record and HubSpot has its own subscription controls.',
            ],
          ]}
        />
        <Callout>
          Mailchimp and Klaviyo treat a list subscription as marketing consent, so Seentics only
          creates one when the visitor actually ticked the consent checkbox on your form. Add a
          consent line to the form if you want those people synced.
        </Callout>
      </DocSection>

      <DocSection title="Zapier, your own backend and other webhooks">
        <P>
          Create a Zap with the <C>Webhooks by Zapier</C> trigger, choose <C>Catch Hook</C>, and paste
          its URL into Seentics. Adding it sends one sample submission (<C>seentics-test@example.com</C>,
          with <C>event: lead.test</C>) so Zapier can learn the field names. Any other service that
          accepts an HTTPS JSON POST works the same way, including a separate CRM or leads app you run
          yourself: add its endpoint as a webhook and set a signing secret so it can verify the
          requests. The URL must be https and must resolve to a public address; internal and private
          addresses are refused.
        </P>
      </DocSection>

      <DocSection title="Credentials and security">
        <Ul>
          <Li>
            Credentials are encrypted with AES-256-GCM before they are stored, under a key you set in
            the <C>INTEGRATIONS_ENCRYPTION_KEY</C> environment variable (32 bytes, base64 or hex;
            generate one with <C>openssl rand -base64 32</C>). A stored value is also bound to its
            website and destination, so it cannot be copied into another one.
          </Li>
          <Li>
            They are never shown again. The dashboard displays only the last few characters of a
            key. Editing a destination leaves the secret fields empty; leave them blank to keep the
            saved one.
          </Li>
          <Li>
            They are never put in an automation, a log line or an error message.
          </Li>
          <Li>
            Without that key, a production server refuses to save credentials and logs an error at
            start if destinations already exist. Development uses a built-in key and warns about it.
          </Li>
          <Li>
            To rotate the key, put the new one in <C>INTEGRATIONS_ENCRYPTION_KEY</C> and keep the old
            in <C>INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS</C> (comma-separated). Existing destinations
            keep working; credentials are re-sealed under the new key when next saved.
          </Li>
        </Ul>
        <Callout>
          Give each integration the narrowest permission it needs: <C>crm.objects.contacts.write</C>{' '}
          (and read, to verify) for HubSpot; profiles, lists and subscriptions write for Klaviyo.
        </Callout>
      </DocSection>

      <DocSection title="What Seentics keeps">
        <Ul>
          <Li>
            A submission is listed on its form&apos;s page for 90 days, then deleted. While a delivery
            is waiting or has failed, the data it needs is held with it so it can be retried; it is
            cleared once the delivery succeeds, and failed ones are cleared after 30 days.
          </Li>
          <Li>
            Seentics is not a contact database. Keep long-term contacts in the destination, such as
            your email platform or CRM.
          </Li>
          <Li>
            The plan limit counts submissions per calendar month. Over it, new submissions are refused
            until the month rolls over or you upgrade.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Limits">
        <Ul>
          <Li>Submissions are delivered as they arrive. Ones from before you added a destination are not back-filled; export them from the form&apos;s page as a CSV while they are still stored.</Li>
          <Li>Up to ten destinations per website.</Li>
          <Li>Names are split on the first space into first and last name, since the form collects a single name.</Li>
          <Li>The <C>Send test</C> button sends a sample submission. For list-based tools that adds a test contact (<C>seentics-test@example.com</C>) you can delete afterwards.</Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
