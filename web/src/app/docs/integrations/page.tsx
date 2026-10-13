import Link from 'next/link';
import { C, Callout, DocPage, DocSection, Li, P, RefTable, Ul } from '@/components/docs/DocsKit';

export const metadata = {
  title: 'Integrations · Seentics docs',
  description: 'Send new leads to Zapier, Mailchimp, Klaviyo and HubSpot, with credentials encrypted at rest.',
};

/**
 * What each provider does is transcribed from `core/modules/integrations/providers/`. If a
 * provider changes how it treats consent or which calls it makes, this page is wrong until it
 * is updated.
 */
export default function IntegrationsPage() {
  return (
    <DocPage
      eyebrow="Core features"
      title="Integrations"
      lead="Every new lead from a popup form can be sent on to the tools you already use."
    >
      <DocSection title="How it works">
        <P>
          Connect a tool in <C>Settings → Integrations</C>. From then on, each submission to a popup
          form (see <Link href="/docs/automations" className="text-primary hover:underline">Automations</Link>)
          is saved to your Leads inbox first, then delivered to every connected tool. The delivery
          happens in the background: a slow or failing tool never delays or breaks the form a visitor
          is looking at.
        </P>
        <Ul>
          <Li>
            <strong>Verified before saving.</strong> Connecting makes a real, read-only call to the
            provider, so a wrong key, audience or missing permission is reported while you are
            looking at it.
          </Li>
          <Li>
            <strong>Retries.</strong> A temporary failure (a timeout, HTTP 429 or a 5xx) is retried
            up to three times with a growing delay. A rejected request (a 4xx) is not, since it
            would be rejected again.
          </Li>
          <Li>
            <strong>Automatic pause.</strong> A rejected credential pauses the connection at once.
            Five leads in a row that fail pauses it too. The card shows <C>Needs attention</C> and
            the last error; switch it back on, or edit the credentials, to resume.
          </Li>
          <Li>
            <strong>A delivery log.</strong> Each attempt, with its outcome, appears under Recent
            deliveries, so <em>did it arrive?</em> always has an answer. The log is trimmed
            automatically and ages out with your other history.
          </Li>
        </Ul>
      </DocSection>

      <DocSection title="Providers">
        <RefTable
          columns={['Provider', 'What you give us', 'What happens to a lead']}
          rows={[
            [
              <C>Zapier / Webhook</C>,
              'The Catch Hook URL, and optionally a signing secret.',
              <>Posts the lead as JSON (<C>event</C>, <C>email</C>, <C>name</C>, <C>phone</C>, <C>consent</C>, <C>fields</C>, and the popup, variant and page it came from). With a secret, requests carry <C>X-Seentics-Signature: sha256=…</C>, an HMAC of the body. Always sent, with the consent flag in the payload.</>,
            ],
            [
              <C>Mailchimp</C>,
              'An API key (including the -us21 style suffix) and an Audience ID.',
              'Adds or updates the member. Only leads who ticked the consent box are sent; others are skipped and stay in your inbox. Optional double opt-in.',
            ],
            [
              <C>Klaviyo</C>,
              'A private API key, and optionally a list ID.',
              'Creates or updates the profile for every lead. With a list: a lead who consented is subscribed to email marketing on it; one who did not is added as a plain member, with no consent recorded.',
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
          consent line to the form if you want those leads synced.
        </Callout>
      </DocSection>

      <DocSection title="Zapier and other webhooks">
        <P>
          Create a Zap with the <C>Webhooks by Zapier</C> trigger, choose <C>Catch Hook</C>, and paste
          its URL into Seentics. Connecting sends one sample lead (<C>seentics-test@example.com</C>,
          with <C>event: lead.test</C>) so Zapier can learn the field names. Any other service that
          accepts an HTTPS JSON POST works the same way. The URL must be https and must resolve to a
          public address; internal and private addresses are refused.
        </P>
      </DocSection>

      <DocSection title="Credentials and security">
        <Ul>
          <Li>
            Credentials are encrypted with AES-256-GCM before they are stored, under a key you set in
            the <C>INTEGRATIONS_ENCRYPTION_KEY</C> environment variable (32 bytes, base64 or hex;
            generate one with <C>openssl rand -base64 32</C>). A stored value is also bound to its
            website and provider, so it cannot be copied into another connection.
          </Li>
          <Li>
            They are never shown again. The dashboard displays only the last few characters of a
            key. Editing a connection leaves the secret fields empty; leave them blank to keep the
            saved one.
          </Li>
          <Li>
            They are never put in an automation, a log line or an error message.
          </Li>
          <Li>
            Without that key, a production server refuses to save credentials and logs an error at
            start if connections already exist. Development uses a built-in key and warns about it.
          </Li>
          <Li>
            To rotate the key, put the new one in <C>INTEGRATIONS_ENCRYPTION_KEY</C> and keep the old
            in <C>INTEGRATIONS_ENCRYPTION_KEY_PREVIOUS</C> (comma-separated). Existing connections
            keep working; credentials are re-sealed under the new key when next saved.
          </Li>
        </Ul>
        <Callout>
          Give each integration the narrowest permission it needs: <C>crm.objects.contacts.write</C>{' '}
          (and read, to verify) for HubSpot; profiles, lists and subscriptions write for Klaviyo.
        </Callout>
      </DocSection>

      <DocSection title="Limits">
        <Ul>
          <Li>Leads are delivered when they are captured. Leads that arrived before you connected a tool are not back-filled; export them from the Leads inbox as a CSV.</Li>
          <Li>Delivery runs inside the Seentics server. If it restarts mid-delivery, that lead is not retried from the log; it is still in your inbox.</Li>
          <Li>Names are split on the first space into first and last name, since the form collects a single name.</Li>
          <Li>The <C>Send test</C> button sends a sample lead. For list-based tools that adds a test contact (<C>seentics-test@example.com</C>) you can delete afterwards.</Li>
        </Ul>
      </DocSection>
    </DocPage>
  );
}
