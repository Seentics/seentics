import type { LaneSpec } from "../../ingest/interfaces";
import type { ConversionAdmin } from "./conversions";
import type { z } from "zod";
import type { ModuleLifecycle } from "../../../app/module";
import type { AuthedRouter } from "../../../platform/http/router";
import type { LeadSink } from "../../leads/interfaces";
import type { RetentionPurge } from "../../../platform/retention";

export const PROVIDER_IDS = ["zapier", "mailchimp", "klaviyo", "hubspot"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ConnectionStatus = "active" | "error";
/** `pending` covers a delivery waiting for its first attempt or for a retry. */
export type DeliveryStatus = "pending" | "success" | "failed" | "skipped";

/**
 * A captured lead, in the shape providers map from.
 *
 * Deliberately not the leads module's types: providers should not depend on them, and
 * everything a connector needs is flat here. `firstName`/`lastName` are split from the single
 * `name` the form collects, once, so four providers do not split it four ways. It is also what
 * the outbox stores as JSON until the lead is delivered.
 */
export type LeadPayload = {
  submissionId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  /** Whether the visitor ticked the marketing-consent checkbox. */
  consent: boolean;
  fields: Record<string, string | number | boolean>;
  /** The reward the visitor was shown, when the popup pays one. */
  prize: { label: string; coupon_code: string | null } | null;
  popupId: string | null;
  variant: string | null;
  pageUrl: string;
  referrer: string;
  submittedAt: string;
  /** True for the dashboard's "send test" button; never for a real visitor. */
  test?: boolean;
};

/** Which delivery a provider call belongs to, so a receiver can de-duplicate a retry. */
export type DeliveryMeta = { id: string };

/**
 * What one attempt at delivering a lead came to.
 *
 * `failed.retryable` is the provider's verdict on whether trying again could help (a
 * 429 or 5xx can; a 400 cannot), and `auth` marks a rejected credential, which the
 * delivery service treats as a reason to switch the connection off at once.
 */
export type Outcome =
  | { kind: "ok"; httpStatus?: number }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; retryable: boolean; auth?: boolean; httpStatus?: number; message: string };

export type HttpRequest = {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
};
export type HttpResponse = { status: number; text: string };

/** What a provider may use. Replaceable in tests; production wires the real `fetch`. */
export type ProviderContext = {
  request(req: HttpRequest): Promise<HttpResponse>;
  /** Throws unless the URL's host resolves to a public address. For user-supplied URLs only. */
  assertPublicUrl(url: string): Promise<void>;
};

/** A field the dashboard renders in a provider's connect dialog. */
export type ProviderField = {
  kind: "credential" | "config";
  name: string;
  label: string;
  type: "text" | "password" | "checkbox";
  placeholder?: string;
  help?: string;
  required: boolean;
};

/**
 * One destination for leads. Adding a provider is adding one file that implements this and
 * one line in the registry.
 *
 * `C` is the credential object (encrypted at rest) and `K` the plain config (list id and
 * the like). Both are validated by their schema before anything is stored or sent.
 */
export interface IntegrationProvider<C = unknown, K = unknown> {
  readonly id: ProviderId;
  readonly label: string;
  readonly description: string;
  readonly docsUrl: string;
  readonly fields: readonly ProviderField[];
  readonly credentialSchema: z.ZodType<C, z.ZodTypeDef, unknown>;
  readonly configSchema: z.ZodType<K, z.ZodTypeDef, unknown>;
  /** The few trailing characters of the primary secret that the dashboard may show. */
  hint(credentials: C): string;
  /** A real, side-effect-free call that proves the credentials and config work. */
  verify(credentials: C, config: K, ctx: ProviderContext): Promise<Outcome>;
  deliver(lead: LeadPayload, credentials: C, config: K, ctx: ProviderContext, delivery?: DeliveryMeta): Promise<Outcome>;
}

/** A destination as the dashboard sees it. Never carries credentials. */
export type ConnectionView = {
  id: string;
  provider: ProviderId;
  name: string;
  enabled: boolean;
  status: ConnectionStatus;
  config: Record<string, unknown>;
  credentials_hint: string;
  consecutive_failures: number;
  last_error: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  /** Leads waiting to be sent, or to be retried. */
  pending_count: number;
  created_at: string;
  updated_at: string;
};

/** A kind of destination the owner can add, with the form to connect it. */
export type ProviderInfo = {
  id: ProviderId;
  label: string;
  description: string;
  docs_url: string;
  fields: readonly ProviderField[];
};

export type DeliveryView = {
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

export type DeliveryQuery = { limit: number; status?: DeliveryStatus; connectionId?: string };

/** Why a connect, update, test or retry did not go through, in words the dashboard can show. */
export type IntegrationFailure = {
  ok: false;
  code: "invalid" | "rejected" | "unavailable" | "not_found" | "no_key" | "connection_limit";
  message: string;
};
export type IntegrationResult<T> = { ok: true; value: T } | IntegrationFailure;

export interface IntegrationQueries {
  list(websiteId: string): Promise<{ providers: ProviderInfo[]; connections: ConnectionView[] }>;
  deliveries(websiteId: string, q: DeliveryQuery): Promise<DeliveryView[]>;
}

export interface IntegrationMutations {
  /** Validate, test against the provider, then store as a new destination. */
  connect(websiteId: string, input: { provider: string; name?: string; credentials: unknown; config: unknown }): Promise<IntegrationResult<ConnectionView>>;
  /** Rename, switch on or off, change config; new credentials, if given, are re-verified. */
  update(websiteId: string, connectionId: string, input: { name?: string; enabled?: boolean; config?: unknown; credentials?: unknown }): Promise<IntegrationResult<ConnectionView>>;
  /** Deletes the destination, its stored credentials and its delivery history. False when there was none. */
  disconnect(websiteId: string, connectionId: string): Promise<boolean>;
  /** Sends a clearly marked sample lead through the destination, outside the queue. */
  sendTest(websiteId: string, connectionId: string): Promise<IntegrationResult<Outcome>>;
  /** Queues a failed delivery for another round of attempts. */
  retryDelivery(websiteId: string, deliveryId: string): Promise<IntegrationResult<{ id: string }>>;
}

export type IntegrationsModule = ModuleLifecycle & {
  queries: IntegrationQueries;
  mutations: IntegrationMutations;
  /** Where the leads module hands over a captured submission. */
  sink: LeadSink;
  /** Server-side conversions: the ingest lane for consented tracker events, and the dashboard's admin. */
  conversions: { lane: LaneSpec; admin: ConversionAdmin; routes: AuthedRouter };
  /** Ages out the delivery history and clears payloads that were never delivered. */
  retention: RetentionPurge;
  routes: AuthedRouter;
};

export type * from "./conversions";
export { CONVERSION_PLATFORMS } from "./conversions";
