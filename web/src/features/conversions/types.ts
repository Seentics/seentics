/**
 * Conversions: a site's purchases, leads, sign-ups and mapped custom events, sent from Seentics'
 * servers to ad platforms. Mirrors core's `/api/v1/conversions` contract.
 */

export type Platform = 'meta' | 'ga4' | 'tiktok' | 'linkedin';
export type EventKind = 'purchase' | 'lead' | 'sign_up' | 'custom';
export type MatchKey = 'click_id' | 'email' | 'phone' | 'ip_ua' | 'browser_id';
export type ConversionStatus = 'pending' | 'success' | 'failed' | 'skipped';

/** Which platform event each kind is sent as; `null` means that kind is not sent. */
export type DestinationConfig = {
  events: { purchase: string | null; lead: string | null; sign_up: string | null };
  custom: { name: string; platform_event: string }[];
  test_event_code?: string | null;
};

export type Destination = {
  id: string;
  platform: Platform;
  name: string;
  enabled: boolean;
  status: 'active' | 'error';
  last_error: string | null;
  credentials_hint: string;
  config: DestinationConfig;
  created_at: string;
  updated_at: string;
  stats: { sent_7d: number; failed_7d: number; last_sent_at: string | null };
};

export type MetaCredentials = { pixel_id: string; access_token: string };
export type Ga4Credentials = { measurement_id: string; api_secret: string };
export type TiktokCredentials = { pixel_code: string; access_token: string };
export type LinkedinCredentials = { ad_account_id: string; access_token: string };
export type Credentials = MetaCredentials | Ga4Credentials | TiktokCredentials | LinkedinCredentials;

export type DestinationInput = {
  platform: Platform;
  name?: string;
  credentials: Credentials;
  config?: Partial<DestinationConfig>;
};

export type DestinationPatch = {
  name?: string;
  enabled?: boolean;
  credentials?: Credentials;
  config?: Partial<DestinationConfig>;
};

export type ConversionEvent = {
  id: string;
  destination_id: string;
  platform: Platform;
  kind: EventKind;
  event_name: string;
  platform_event: string;
  status: ConversionStatus;
  error: string | null;
  attempt_count: number;
  match_keys: MatchKey[];
  value: number | null;
  currency: string | null;
  order_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ConversionEventFilters = {
  destination: string;
  status: ConversionStatus | '';
  kind: EventKind | '';
  /** Only the last this many days; 0 or absent for every event kept. */
  days?: number;
  limit: number;
  offset: number;
};

export type ConversionEventPage = { events: ConversionEvent[]; total: number };

export type ConversionSummary = {
  totals: { sent: number; accepted: number; failed: number; skipped: number; pending: number };
  by_day: { day: string; accepted: number; failed: number }[];
  match: { total: number } & Record<MatchKey, number>;
  by_kind: { kind: EventKind; accepted: number }[];
};

export type TestResult = { ok: boolean; message: string };

export const DEFAULT_EVENTS: Record<Platform, DestinationConfig['events']> = {
  meta: { purchase: 'Purchase', lead: 'Lead', sign_up: 'CompleteRegistration' },
  ga4: { purchase: 'purchase', lead: 'generate_lead', sign_up: 'sign_up' },
  tiktok: { purchase: 'CompletePayment', lead: 'SubmitForm', sign_up: 'CompleteRegistration' },
  // LinkedIn has no standard names: each event goes to a conversion rule, by its id.
  linkedin: { purchase: null, lead: null, sign_up: null },
};

export const MATCH_KEYS: readonly MatchKey[] = ['click_id', 'email', 'phone', 'ip_ua', 'browser_id'];
