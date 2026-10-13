export type ProviderId = 'zapier' | 'mailchimp' | 'klaviyo' | 'hubspot';

export type ProviderField = {
  kind: 'credential' | 'config';
  name: string;
  label: string;
  type: 'text' | 'password' | 'checkbox';
  placeholder?: string;
  help?: string;
  required: boolean;
};

/** A connection as the API returns it. There is no credentials field, by design. */
export type Connection = {
  provider: ProviderId;
  enabled: boolean;
  status: 'active' | 'error';
  config: Record<string, unknown>;
  /** The last few characters of the secret, to recognise it by. */
  credentials_hint: string;
  consecutive_failures: number;
  last_error: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
};

export type Provider = {
  id: ProviderId;
  label: string;
  description: string;
  docs_url: string;
  fields: ProviderField[];
  connection: Connection | null;
};

export type Delivery = {
  id: string;
  provider: ProviderId;
  contact_id: string | null;
  status: 'success' | 'failed' | 'skipped';
  attempt_count: number;
  http_status: number | null;
  error: string | null;
  duration_ms: number;
  created_at: string;
};

/** What a test send came to. */
export type TestOutcome =
  | { kind: 'ok'; httpStatus?: number }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; message: string; retryable: boolean; auth?: boolean };

export type ConnectInput = {
  credentials: Record<string, string>;
  config: Record<string, string | boolean>;
};

export type UpdateInput = {
  enabled?: boolean;
  config?: Record<string, string | boolean>;
  credentials?: Record<string, string>;
};
