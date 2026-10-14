/**
 * Pure helpers for the integrations UI: turning a connect dialog's values into the request,
 * and a connection's state into words. Kept out of the components so the rules — secrets are
 * never prefilled, blank optional fields are left out, checkboxes are booleans — are tested
 * without rendering anything.
 */
import type {
  Connection, CreateInput, Delivery, DeliveryStatus, Provider, ProviderField, TestOutcome, UpdateInput,
} from '@/features/integrations/types';

export type FormValues = Record<string, string | boolean>;

/**
 * Starting values for a dialog.
 *
 * Config is prefilled from the saved connection so it can be edited; credentials never are —
 * the API does not return them, and the field starts empty so "leave blank to keep" is the
 * honest state of a saved secret.
 */
export function initialValues(fields: readonly ProviderField[], connection: Connection | null): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    if (f.kind === 'credential') values[f.name] = '';
    else if (f.type === 'checkbox') values[f.name] = connection?.config?.[f.name] === true;
    else values[f.name] = typeof connection?.config?.[f.name] === 'string' ? (connection.config[f.name] as string) : '';
  }
  return values;
}

/** Fields the user must still fill in. A saved secret may stay blank: it is kept. */
export function missingRequired(fields: readonly ProviderField[], values: FormValues, connected: boolean): ProviderField[] {
  return fields.filter((f) => {
    if (!f.required || f.type === 'checkbox') return false;
    if (f.kind === 'credential' && connected) return false;
    return String(values[f.name] ?? '').trim() === '';
  });
}

function split(fields: readonly ProviderField[], values: FormValues) {
  const credentials: Record<string, string> = {};
  const config: Record<string, string | boolean> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.kind === 'credential') {
      const s = String(v ?? '').trim();
      if (s) credentials[f.name] = s;
    } else if (f.type === 'checkbox') {
      config[f.name] = v === true;
    } else {
      const s = String(v ?? '').trim();
      if (s) config[f.name] = s;
    }
  }
  return { credentials, config };
}

/** The most destinations a site can have; the server enforces the same cap. */
export const MAX_DESTINATIONS_PER_SITE = 10;
export const MAX_NAME_LENGTH = 80;

/** A name for a new destination that no other one on the site uses: "Mailchimp", then "Mailchimp 2". */
export function defaultName(provider: Pick<Provider, 'label'>, existing: readonly Pick<Connection, 'name'>[]): string {
  const taken = new Set(existing.map((c) => c.name.toLowerCase()));
  if (!taken.has(provider.label.toLowerCase())) return provider.label;
  for (let n = 2; ; n++) if (!taken.has(`${provider.label} ${n}`.toLowerCase())) return `${provider.label} ${n}`;
}

/** The body for a new destination: its name, every credential, and the config. */
export const toCreateInput = (provider: Pick<Provider, 'id' | 'fields'>, name: string, values: FormValues): CreateInput => ({
  provider: provider.id,
  name: name.trim(),
  ...split(provider.fields, values),
});

/**
 * The body for editing a saved connection. Credentials are sent only if the user typed new
 * ones, which makes the server re-verify them; otherwise only the config goes.
 */
export function toUpdateInput(fields: readonly ProviderField[], values: FormValues, name?: string): UpdateInput {
  const { credentials, config } = split(fields, values);
  return { ...(name !== undefined ? { name: name.trim() } : {}), config, ...(Object.keys(credentials).length ? { credentials } : {}) };
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted';

/** One line and a tone for a destination's state, for the card badge. */
export function describeConnection(c: Connection): { label: string; tone: StatusTone } {
  if (c.status === 'error') return { label: 'Needs attention', tone: 'danger' };
  if (!c.enabled) return { label: 'Paused', tone: 'warning' };
  if (c.pending_count > 0 && c.consecutive_failures > 0) return { label: 'Retrying', tone: 'warning' };
  return { label: 'Connected', tone: 'success' };
}

const DELIVERY_LABEL: Record<DeliveryStatus, { label: string; tone: StatusTone }> = {
  success: { label: 'Delivered', tone: 'success' },
  pending: { label: 'Retrying', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'muted' },
};

/** A delivery's state as a word and tone. A pending delivery that has not been tried yet is "Queued". */
export function describeDelivery(d: Pick<Delivery, 'status' | 'attempt_count'>): { label: string; tone: StatusTone } {
  if (d.status === 'pending' && d.attempt_count <= 1) return { label: 'Queued', tone: 'muted' };
  return DELIVERY_LABEL[d.status];
}

/** Only a delivery that gave up can be put back in the queue by hand. */
export const canRetry = (d: Pick<Delivery, 'status'>) => d.status === 'failed';

/** The sentence under a test send, honest about a skip. */
export function describeTest(outcome: TestOutcome): { ok: boolean; message: string } {
  switch (outcome.kind) {
    case 'ok': return { ok: true, message: 'Test submission sent. Check the destination for seentics-test@example.com.' };
    case 'skipped': return { ok: true, message: outcome.reason };
    case 'failed': return { ok: false, message: outcome.auth ? `The provider rejected the credentials: ${outcome.message}` : outcome.message };
  }
}

/** How long until a moment: `in 2m`, `in 3h`. A moment already past reads `now`, since the worker is about to pick it up. */
export function untilTime(iso: string, now: number = Date.now()): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return '';
  const secs = Math.round((at - now) / 1000);
  if (secs <= 0) return 'now';
  if (secs < 60) return `in ${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}
