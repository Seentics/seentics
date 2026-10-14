import { describe, expect, it } from 'vitest';
import {
  canRetry, defaultName, describeConnection, describeDelivery, describeTest, initialValues, missingRequired,
  toCreateInput, toUpdateInput, untilTime,
} from '@/lib/integration-form';
import type { Connection, ProviderField } from '@/features/integrations/types';

const fields: ProviderField[] = [
  { kind: 'credential', name: 'api_key', label: 'API key', type: 'password', required: true },
  { kind: 'config', name: 'audience_id', label: 'Audience ID', type: 'text', required: true },
  { kind: 'config', name: 'double_opt_in', label: 'Double opt-in', type: 'checkbox', required: false },
  { kind: 'config', name: 'note', label: 'Note', type: 'text', required: false },
];

const connection: Connection = {
  id: 'c1', provider: 'mailchimp', name: 'Newsletter', enabled: true, status: 'active', credentials_hint: 'cdef', consecutive_failures: 0,
  last_error: null, last_attempt_at: null, last_success_at: null, pending_count: 0,
  created_at: '2025-03-01T00:00:00.000Z', updated_at: '2025-03-01T00:00:00.000Z',
  config: { audience_id: 'abc123', double_opt_in: true },
};
const mailchimp = { id: 'mailchimp' as const, label: 'Mailchimp', fields };

describe('initialValues', () => {
  it('starts empty for a new connection', () => {
    expect(initialValues(fields, null)).toEqual({ api_key: '', audience_id: '', double_opt_in: false, note: '' });
  });

  it('prefills config but never a credential', () => {
    const v = initialValues(fields, connection);
    expect(v).toEqual({ api_key: '', audience_id: 'abc123', double_opt_in: true, note: '' });
  });
});

describe('missingRequired', () => {
  it('asks for the secret and required config on a new connection', () => {
    expect(missingRequired(fields, initialValues(fields, null), false).map((f) => f.name)).toEqual(['api_key', 'audience_id']);
  });

  it('lets a saved secret stay blank', () => {
    expect(missingRequired(fields, initialValues(fields, connection), true)).toEqual([]);
  });

  it('treats whitespace as empty', () => {
    expect(missingRequired(fields, { api_key: '  ', audience_id: ' ', double_opt_in: false, note: '' }, false)).toHaveLength(2);
  });
});

describe('request bodies', () => {
  const values = { api_key: '  key-123  ', audience_id: ' abc123 ', double_opt_in: true, note: '' };

  it('splits credentials from config, trims, and omits blank optionals', () => {
    expect(toCreateInput(mailchimp, '  Newsletter ', values)).toEqual({
      provider: 'mailchimp', name: 'Newsletter', credentials: { api_key: 'key-123' }, config: { audience_id: 'abc123', double_opt_in: true },
    });
  });

  it('always sends checkboxes as booleans', () => {
    expect(toCreateInput(mailchimp, 'x', { ...values, double_opt_in: false }).config.double_opt_in).toBe(false);
  });

  it('sends the name on update only when it is given', () => {
    expect(toUpdateInput(fields, { ...values, api_key: '' }, ' Renamed ')).toMatchObject({ name: 'Renamed' });
    expect(toUpdateInput(fields, { ...values, api_key: '' })).not.toHaveProperty('name');
  });

  it('sends credentials on update only when new ones were typed', () => {
    expect(toUpdateInput(fields, { ...values, api_key: '' })).toEqual({ config: { audience_id: 'abc123', double_opt_in: true } });
    expect(toUpdateInput(fields, values)).toEqual({ config: { audience_id: 'abc123', double_opt_in: true }, credentials: { api_key: 'key-123' } });
  });
});

describe('describeConnection', () => {
  it('names each state', () => {
    expect(describeConnection(connection)).toEqual({ label: 'Connected', tone: 'success' });
    expect(describeConnection({ ...connection, enabled: false })).toEqual({ label: 'Paused', tone: 'warning' });
    expect(describeConnection({ ...connection, enabled: false, status: 'error' })).toEqual({ label: 'Needs attention', tone: 'danger' });
    expect(describeConnection({ ...connection, pending_count: 2, consecutive_failures: 1 })).toEqual({ label: 'Retrying', tone: 'warning' });
  });

  it('does not call a connection retrying just because deliveries are queued', () => {
    expect(describeConnection({ ...connection, pending_count: 3 })).toEqual({ label: 'Connected', tone: 'success' });
  });
});

describe('defaultName', () => {
  it('uses the provider label, then numbers it, never repeating a name (case-insensitive)', () => {
    expect(defaultName({ label: 'Mailchimp' }, [])).toBe('Mailchimp');
    expect(defaultName({ label: 'Mailchimp' }, [{ name: 'mailchimp' }])).toBe('Mailchimp 2');
    expect(defaultName({ label: 'Mailchimp' }, [{ name: 'Mailchimp' }, { name: 'Mailchimp 2' }])).toBe('Mailchimp 3');
  });
});

describe('describeDelivery', () => {
  it('names each state, and tells a first queued attempt from a retry', () => {
    expect(describeDelivery({ status: 'success', attempt_count: 1 })).toEqual({ label: 'Delivered', tone: 'success' });
    expect(describeDelivery({ status: 'pending', attempt_count: 1 })).toEqual({ label: 'Queued', tone: 'muted' });
    expect(describeDelivery({ status: 'pending', attempt_count: 3 })).toEqual({ label: 'Retrying', tone: 'warning' });
    expect(describeDelivery({ status: 'failed', attempt_count: 6 })).toEqual({ label: 'Failed', tone: 'danger' });
    expect(describeDelivery({ status: 'skipped', attempt_count: 1 })).toEqual({ label: 'Skipped', tone: 'muted' });
  });

  it('offers a manual retry only once a delivery has given up', () => {
    expect(['pending', 'success', 'skipped', 'failed'].filter((status) => canRetry({ status: status as 'failed' }))).toEqual(['failed']);
  });
});

describe('describeTest', () => {
  it('explains each outcome', () => {
    expect(describeTest({ kind: 'ok' })).toMatchObject({ ok: true });
    expect(describeTest({ kind: 'skipped', reason: 'No marketing consent given' })).toEqual({ ok: true, message: 'No marketing consent given' });
    expect(describeTest({ kind: 'failed', message: 'HTTP 401', retryable: false, auth: true })).toMatchObject({ ok: false, message: expect.stringContaining('rejected') });
  });
});

describe('untilTime', () => {
  const now = Date.parse('2025-03-31T12:00:00.000Z');
  it('reads forward, and calls a past moment "now"', () => {
    expect(untilTime('2025-03-31T12:00:30.000Z', now)).toBe('in 30s');
    expect(untilTime('2025-03-31T12:10:00.000Z', now)).toBe('in 10m');
    expect(untilTime('2025-03-31T18:00:00.000Z', now)).toBe('in 6h');
    expect(untilTime('2025-04-02T12:00:00.000Z', now)).toBe('in 2d');
    expect(untilTime('2025-03-31T11:59:00.000Z', now)).toBe('now');
    expect(untilTime('garbage', now)).toBe('');
  });
});
