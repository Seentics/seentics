/**
 * Pure helpers for the integrations UI: turning a connect dialog's values into the request,
 * and a connection's state into words. Kept out of the components so the rules — secrets are
 * never prefilled, blank optional fields are left out, checkboxes are booleans — are tested
 * without rendering anything.
 */
import type { Connection, ConnectInput, ProviderField, TestOutcome, UpdateInput } from '@/features/integrations/types';

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

/** The body for a first connection: every credential, and the config. */
export const toConnectInput = (fields: readonly ProviderField[], values: FormValues): ConnectInput => split(fields, values);

/**
 * The body for editing a saved connection. Credentials are sent only if the user typed new
 * ones, which makes the server re-verify them; otherwise only the config goes.
 */
export function toUpdateInput(fields: readonly ProviderField[], values: FormValues): UpdateInput {
  const { credentials, config } = split(fields, values);
  return { config, ...(Object.keys(credentials).length ? { credentials } : {}) };
}

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted';

/** One line and a tone for a connection's state, for the card badge. */
export function describeConnection(c: Connection | null): { label: string; tone: StatusTone } {
  if (!c) return { label: 'Not connected', tone: 'muted' };
  if (c.status === 'error') return { label: 'Needs attention', tone: 'danger' };
  if (!c.enabled) return { label: 'Paused', tone: 'warning' };
  return { label: 'Connected', tone: 'success' };
}

/** The sentence under a test send, honest about a skip. */
export function describeTest(outcome: TestOutcome): { ok: boolean; message: string } {
  switch (outcome.kind) {
    case 'ok': return { ok: true, message: 'Test lead sent. Check the destination for seentics-test@example.com.' };
    case 'skipped': return { ok: true, message: outcome.reason };
    case 'failed': return { ok: false, message: outcome.auth ? `The provider rejected the credentials: ${outcome.message}` : outcome.message };
  }
}
