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

/** A kind of destination a site can add. The same provider can be added more than once. */
export type Provider = {
  id: ProviderId;
  label: string;
  description: string;
  docs_url: string;
  fields: ProviderField[];
};

/** One destination on a site, as the API returns it. There is no credentials field, by design. */
export type Connection = {
  id: string;
  provider: ProviderId;
  name: string;
  enabled: boolean;
  status: 'active' | 'error';
  config: Record<string, unknown>;
  /** The last few characters of the secret, to recognise it by. */
  credentials_hint: string;
  consecutive_failures: number;
  last_error: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  /** Deliveries still waiting for their turn or for a retry. */
  pending_count: number;
  created_at: string;
  updated_at: string;
};

/** Everything the integrations page needs from `GET /integrations/:website`. */
export type IntegrationOverview = { providers: Provider[]; connections: Connection[] };

export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'skipped';

export type Delivery = {
  id: string;
  connection_id: string;
  connection_name: string;
  provider: ProviderId;
  submission_id: string;
  automation_id: string | null;
  status: DeliveryStatus;
  attempt_count: number;
  /** When a pending delivery will next be tried. */
  next_attempt_at: string | null;
  http_status: number | null;
  error: string | null;
  duration_ms: number;
  created_at: string;
  completed_at: string | null;
};

export type DeliveryFilters = { limit?: number; status?: DeliveryStatus; connection_id?: string };

/** What a test send came to. */
export type TestOutcome =
  | { kind: 'ok'; httpStatus?: number }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; message: string; retryable: boolean; auth?: boolean };

export type CreateInput = {
  provider: ProviderId;
  name: string;
  credentials: Record<string, string>;
  config: Record<string, string | boolean>;
};

export type UpdateInput = {
  name?: string;
  enabled?: boolean;
  config?: Record<string, string | boolean>;
  credentials?: Record<string, string>;
};
