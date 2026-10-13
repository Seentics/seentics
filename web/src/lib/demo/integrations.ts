/**
 * Demo integrations for Settings > Integrations (websiteId === "demo").
 *
 * The provider descriptions mirror the ones the API serves, with Mailchimp and Zapier shown
 * as connected and a short delivery log that includes one failure, so every state of the page
 * can be seen. Nothing here can be changed: the demo's mutations are guarded, and no
 * credential a visitor types ever leaves the browser.
 */
import type { Connection, Delivery, Provider } from '@/features/integrations/types';
import { demoDate } from './fixture-utils';

const MIN = 60_000;
const HOUR = 60 * MIN;
const iso = (agoMs: number) => demoDate(-agoMs).toISOString();

const connection = (provider: Connection['provider'], hint: string, agoMs: number, config: Record<string, unknown> = {}): Connection => ({
  provider, enabled: true, status: 'active', config, credentials_hint: hint,
  consecutive_failures: 0, last_error: null, last_attempt_at: iso(agoMs), last_success_at: iso(agoMs),
});

export const demoProviders = (): Provider[] => [
  {
    id: 'zapier', label: 'Zapier / Webhook',
    description: 'Send every new lead to a Zapier Catch Hook, or to any HTTPS endpoint that accepts JSON.',
    docs_url: 'https://help.zapier.com/hc/en-us/articles/8496083355661',
    fields: [
      { kind: 'credential', name: 'webhook_url', label: 'Webhook URL', type: 'password', placeholder: 'https://hooks.zapier.com/hooks/catch/…', help: "Copy it from your Zap's Catch Hook trigger. Treat it like a password.", required: true },
      { kind: 'credential', name: 'signing_secret', label: 'Signing secret (optional)', type: 'password', help: 'If set, requests carry an X-Seentics-Signature HMAC so you can verify them.', required: false },
    ],
    connection: connection('zapier', '…/8f3a2c', 12 * MIN),
  },
  {
    id: 'mailchimp', label: 'Mailchimp',
    description: 'Add leads who gave consent to a Mailchimp audience.',
    docs_url: 'https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/',
    fields: [
      { kind: 'credential', name: 'api_key', label: 'API key', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21', help: 'Account > Extras > API keys.', required: true },
      { kind: 'config', name: 'audience_id', label: 'Audience ID', type: 'text', help: 'Audience > Settings > Audience name and defaults.', required: true },
      { kind: 'config', name: 'double_opt_in', label: 'Require email confirmation (double opt-in)', type: 'checkbox', required: false },
    ],
    connection: connection('mailchimp', '…-us21', 12 * MIN, { audience_id: 'a1b2c3d4e5', double_opt_in: true }),
  },
  {
    id: 'klaviyo', label: 'Klaviyo',
    description: 'Create Klaviyo profiles and subscribe consenting leads to a list.',
    docs_url: 'https://developers.klaviyo.com/en/reference/create_or_update_profile',
    fields: [
      { kind: 'credential', name: 'api_key', label: 'Private API key', type: 'password', placeholder: 'pk_…', help: 'Settings > API keys. Needs profiles:write, and lists:write and subscriptions:write for a list.', required: true },
      { kind: 'config', name: 'list_id', label: 'List ID (optional)', type: 'text', help: 'Lists & Segments > your list > Settings.', required: false },
    ],
    connection: null,
  },
  {
    id: 'hubspot', label: 'HubSpot',
    description: 'Create or update HubSpot contacts from new leads.',
    docs_url: 'https://developers.hubspot.com/docs/api/crm/contacts',
    fields: [
      { kind: 'credential', name: 'access_token', label: 'Private app access token', type: 'password', placeholder: 'pat-…', help: 'Settings > Integrations > Private Apps. Needs the crm.objects.contacts.write scope (and read to verify).', required: true },
    ],
    connection: null,
  },
];

const delivery = (n: number, provider: Delivery['provider'], contact: number, status: Delivery['status'], agoMs: number, extra: Partial<Delivery> = {}): Delivery => ({
  id: `demo-delivery-${n}`, provider,
  contact_id: `00000000-0000-4000-8000-${String(contact).padStart(12, '0')}`,
  status, attempt_count: 1, http_status: status === 'success' ? 200 : null, error: null,
  duration_ms: 180 + n * 37, created_at: iso(agoMs), ...extra,
});

export const demoDeliveries = (limit = 25): Delivery[] => [
  delivery(1, 'zapier', 1, 'success', 2 * HOUR),
  delivery(2, 'mailchimp', 1, 'success', 2 * HOUR),
  delivery(3, 'zapier', 2, 'success', 5 * HOUR),
  delivery(4, 'mailchimp', 2, 'success', 5 * HOUR, { attempt_count: 2 }),
  delivery(5, 'zapier', 3, 'success', 9 * HOUR),
  delivery(6, 'mailchimp', 3, 'skipped', 9 * HOUR, { http_status: null, error: 'No marketing consent given', duration_ms: 0 }),
  delivery(7, 'mailchimp', 4, 'failed', 26 * HOUR, { attempt_count: 3, http_status: 503, error: 'Mailchimp returned 503 (service unavailable)' }),
  delivery(8, 'zapier', 4, 'success', 26 * HOUR),
  delivery(9, 'zapier', 5, 'success', 30 * HOUR),
  delivery(10, 'mailchimp', 5, 'success', 30 * HOUR),
].slice(0, limit);
