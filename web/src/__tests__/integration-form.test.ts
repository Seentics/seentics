import { describe, expect, it } from 'vitest';
import {
  describeConnection, describeTest, initialValues, missingRequired, toConnectInput, toUpdateInput,
} from '@/lib/integration-form';
import type { Connection, ProviderField } from '@/features/integrations/types';

const fields: ProviderField[] = [
  { kind: 'credential', name: 'api_key', label: 'API key', type: 'password', required: true },
  { kind: 'config', name: 'audience_id', label: 'Audience ID', type: 'text', required: true },
  { kind: 'config', name: 'double_opt_in', label: 'Double opt-in', type: 'checkbox', required: false },
  { kind: 'config', name: 'note', label: 'Note', type: 'text', required: false },
];

const connection: Connection = {
  provider: 'mailchimp', enabled: true, status: 'active', credentials_hint: 'cdef', consecutive_failures: 0,
  last_error: null, last_attempt_at: null, last_success_at: null,
  config: { audience_id: 'abc123', double_opt_in: true },
};

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
    expect(toConnectInput(fields, values)).toEqual({ credentials: { api_key: 'key-123' }, config: { audience_id: 'abc123', double_opt_in: true } });
  });

  it('always sends checkboxes as booleans', () => {
    expect(toConnectInput(fields, { ...values, double_opt_in: false }).config.double_opt_in).toBe(false);
  });

  it('sends credentials on update only when new ones were typed', () => {
    expect(toUpdateInput(fields, { ...values, api_key: '' })).toEqual({ config: { audience_id: 'abc123', double_opt_in: true } });
    expect(toUpdateInput(fields, values)).toEqual({ config: { audience_id: 'abc123', double_opt_in: true }, credentials: { api_key: 'key-123' } });
  });
});

describe('describeConnection', () => {
  it('names each state', () => {
    expect(describeConnection(null)).toEqual({ label: 'Not connected', tone: 'muted' });
    expect(describeConnection(connection)).toEqual({ label: 'Connected', tone: 'success' });
    expect(describeConnection({ ...connection, enabled: false })).toEqual({ label: 'Paused', tone: 'warning' });
    expect(describeConnection({ ...connection, enabled: false, status: 'error' })).toEqual({ label: 'Needs attention', tone: 'danger' });
  });
});

describe('describeTest', () => {
  it('explains each outcome', () => {
    expect(describeTest({ kind: 'ok' })).toMatchObject({ ok: true });
    expect(describeTest({ kind: 'skipped', reason: 'No marketing consent given' })).toEqual({ ok: true, message: 'No marketing consent given' });
    expect(describeTest({ kind: 'failed', message: 'HTTP 401', retryable: false, auth: true })).toMatchObject({ ok: false, message: expect.stringContaining('rejected') });
  });
});
