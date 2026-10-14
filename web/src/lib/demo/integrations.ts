/**
 * Demo destinations for Settings > Integrations and the form pages (websiteId === "demo").
 *
 * Three destinations — two webhooks and Mailchimp — chosen so every state of the page can be
 * seen: one healthy, one retrying, one switched off after failures. The provider descriptions
 * mirror the ones the API serves. Nothing here can be changed: the demo's mutations are
 * guarded, and no credential a visitor types ever leaves the browser.
 */
import type {
  Connection, Delivery, DeliveryFilters, IntegrationOverview, Provider,
} from '@/features/integrations/types';
import { demoDate } from './fixture-utils';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Timestamps are relative to the demo's fixed clock, so the page reads the same on every visit. */
export const demoIso = (offsetMs: number) => demoDate(offsetMs).toISOString();
const ago = (ms: number) => demoIso(-ms);

/** Fixed ids so demo forms, submissions and the delivery log all refer to the same destinations. */
export const DEMO_DESTINATIONS = {
  crm: '00000000-0000-4000-8000-0000000000c1',
  mailchimp: '00000000-0000-4000-8000-0000000000c2',
  slack: '00000000-0000-4000-8000-0000000000c3',
} as const;

export const DEMO_DESTINATION_NAMES: Record<string, { name: string; provider: Connection['provider'] }> = {
  [DEMO_DESTINATIONS.crm]: { name: 'Leads platform', provider: 'zapier' },
  [DEMO_DESTINATIONS.mailchimp]: { name: 'Newsletter audience', provider: 'mailchimp' },
  [DEMO_DESTINATIONS.slack]: { name: 'Slack alerts', provider: 'zapier' },
};

export const demoProviders = (): Provider[] => [
  {
    id: 'zapier', label: 'Zapier / Webhook',
    description: 'Send every submission to a Zapier Catch Hook, or to any HTTPS endpoint that accepts JSON.',
    docs_url: 'https://help.zapier.com/hc/en-us/articles/8496083355661',
    fields: [
      { kind: 'credential', name: 'webhook_url', label: 'Webhook URL', type: 'password', placeholder: 'https://hooks.zapier.com/hooks/catch/…', help: "Copy it from your Zap's Catch Hook trigger. Treat it like a password.", required: true },
      { kind: 'credential', name: 'signing_secret', label: 'Signing secret (optional)', type: 'password', help: 'If set, requests carry an X-Seentics-Signature HMAC so you can verify them.', required: false },
    ],
  },
  {
    id: 'mailchimp', label: 'Mailchimp',
    description: 'Add people who gave consent to a Mailchimp audience.',
    docs_url: 'https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/',
    fields: [
      { kind: 'credential', name: 'api_key', label: 'API key', type: 'password', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21', help: 'Account > Extras > API keys.', required: true },
      { kind: 'config', name: 'audience_id', label: 'Audience ID', type: 'text', help: 'Audience > Settings > Audience name and defaults.', required: true },
      { kind: 'config', name: 'double_opt_in', label: 'Require email confirmation (double opt-in)', type: 'checkbox', required: false },
    ],
  },
  {
    id: 'klaviyo', label: 'Klaviyo',
    description: 'Create Klaviyo profiles and subscribe consenting people to a list.',
    docs_url: 'https://developers.klaviyo.com/en/reference/create_or_update_profile',
    fields: [
      { kind: 'credential', name: 'api_key', label: 'Private API key', type: 'password', placeholder: 'pk_…', help: 'Settings > API keys. Needs profiles:write, and lists:write and subscriptions:write for a list.', required: true },
      { kind: 'config', name: 'list_id', label: 'List ID (optional)', type: 'text', help: 'Lists & Segments > your list > Settings.', required: false },
    ],
  },
  {
    id: 'hubspot', label: 'HubSpot',
    description: 'Create or update HubSpot contacts from new submissions.',
    docs_url: 'https://developers.hubspot.com/docs/api/crm/contacts',
    fields: [
      { kind: 'credential', name: 'access_token', label: 'Private app access token', type: 'password', placeholder: 'pat-…', help: 'Settings > Integrations > Private Apps. Needs the crm.objects.contacts.write scope (and read to verify).', required: true },
    ],
  },
];

const base = (id: string, hint: string): Connection => ({
  id, provider: DEMO_DESTINATION_NAMES[id]!.provider, name: DEMO_DESTINATION_NAMES[id]!.name,
  enabled: true, status: 'active', config: {}, credentials_hint: hint,
  consecutive_failures: 0, last_error: null, last_attempt_at: ago(12 * MIN), last_success_at: ago(12 * MIN),
  pending_count: 0, created_at: ago(40 * DAY), updated_at: ago(2 * DAY),
});

export const demoConnections = (): Connection[] => [
  base(DEMO_DESTINATIONS.crm, '/8f3a2c'),
  // Retrying: the last attempt hit a 503, one submission is waiting for its next try.
  {
    ...base(DEMO_DESTINATIONS.mailchimp, '-us21'),
    config: { audience_id: 'a1b2c3d4e5', double_opt_in: true },
    last_error: 'Mailchimp returned 503 (service unavailable)', last_attempt_at: ago(9 * MIN), last_success_at: ago(3 * HOUR),
    consecutive_failures: 1, pending_count: 1,
  },
  // Switched off after repeated failures: the endpoint answers 410 Gone.
  {
    ...base(DEMO_DESTINATIONS.slack, '/b71d90'),
    enabled: false, status: 'error', consecutive_failures: 5,
    last_error: 'Webhook returned 410 (gone)', last_attempt_at: ago(20 * HOUR), last_success_at: ago(2 * DAY),
  },
];

export const demoOverview = (): IntegrationOverview => ({ providers: demoProviders(), connections: demoConnections() });

const row = (n: number, destination: keyof typeof DEMO_DESTINATIONS, submission: number, status: Delivery['status'], agoMs: number, extra: Partial<Delivery> = {}): Delivery => {
  const id = DEMO_DESTINATIONS[destination];
  const meta = DEMO_DESTINATION_NAMES[id]!;
  return {
    id: `demo-delivery-${n}`, connection_id: id, connection_name: meta.name, provider: meta.provider,
    submission_id: `demo-sub-${submission}`, automation_id: null, status, attempt_count: 1,
    next_attempt_at: null, http_status: status === 'success' ? 200 : null, error: null, duration_ms: 180 + n * 37,
    created_at: ago(agoMs), completed_at: status === 'pending' ? null : ago(agoMs - 4_000), ...extra,
  };
};

/** Newest first, one of every status so the log's states and the Retry action can be seen. */
const DELIVERIES: Delivery[] = [
  row(1, 'crm', 1, 'success', 2 * HOUR),
  row(2, 'mailchimp', 1, 'pending', 2 * HOUR, { attempt_count: 2, http_status: 503, error: 'Mailchimp returned 503 (service unavailable)', next_attempt_at: demoIso(2 * MIN), completed_at: null }),
  row(3, 'crm', 2, 'success', 5 * HOUR),
  row(4, 'slack', 2, 'success', 5 * HOUR),
  row(5, 'crm', 3, 'success', 9 * HOUR),
  row(6, 'mailchimp', 3, 'skipped', 9 * HOUR, { error: 'No marketing consent given', duration_ms: 0 }),
  row(7, 'slack', 4, 'failed', 20 * HOUR, { attempt_count: 1, http_status: 410, error: 'Webhook returned 410 (gone)' }),
  row(8, 'crm', 4, 'success', 20 * HOUR),
  row(9, 'mailchimp', 5, 'failed', 26 * HOUR, { attempt_count: 6, http_status: 503, error: 'Mailchimp returned 503 (service unavailable)' }),
  row(10, 'crm', 5, 'success', 26 * HOUR, { attempt_count: 2 }),
  row(11, 'crm', 6, 'success', 30 * HOUR),
  row(12, 'mailchimp', 6, 'success', 30 * HOUR),
];

export const demoDeliveries = (filters: DeliveryFilters = {}): Delivery[] =>
  DELIVERIES
    .filter((d) => (!filters.status || d.status === filters.status) && (!filters.connection_id || d.connection_id === filters.connection_id))
    .slice(0, filters.limit ?? 25);
