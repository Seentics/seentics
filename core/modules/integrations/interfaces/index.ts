import type { z } from "zod";
import type { ModuleLifecycle } from "../../../app/module";
import type { AuthedRouter } from "../../../platform/http/router";
import type { RetentionPurge } from "../../../platform/retention";

export const PROVIDER_IDS = ["zapier", "mailchimp", "klaviyo", "hubspot"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ConnectionStatus = "active" | "error";
export type DeliveryStatus = "success" | "failed" | "skipped";

/**
 * A captured lead, in the shape providers map from.
 *
 * Deliberately not `CapturedLead`: providers should not depend on the leads module's
 * types, and everything a connector needs is flat here. `firstName`/`lastName` are split
 * from the single `name` the form collects, once, so four providers do not split it four ways.
 */
export type LeadPayload = {
  contactId: string;
  isNewContact: boolean;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  /** Whether the visitor ticked the marketing-consent checkbox. */
  consent: boolean;
  fields: Record<string, string | number | boolean>;
  popupId: string | null;
  variant: string | null;
  pageUrl: string;
  referrer: string;
  submittedAt: string;
  /** True for the dashboard's "send test" button; never for a real visitor. */
  test?: boolean;
};

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
  deliver(lead: LeadPayload, credentials: C, config: K, ctx: ProviderContext): Promise<Outcome>;
}

/** A connection as the dashboard sees it. Never carries credentials. */
export type ConnectionView = {
  provider: ProviderId;
  enabled: boolean;
  status: ConnectionStatus;
  config: Record<string, unknown>;
  credentials_hint: string;
  consecutive_failures: number;
  last_error: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProviderView = {
  id: ProviderId;
  label: string;
  description: string;
  docs_url: string;
  fields: readonly ProviderField[];
  connection: ConnectionView | null;
};

export type DeliveryView = {
  id: string;
  provider: ProviderId;
  contact_id: string | null;
  status: DeliveryStatus;
  attempt_count: number;
  http_status: number | null;
  error: string | null;
  duration_ms: number;
  created_at: string;
};

/** Why a connect, update or test did not go through, in words the dashboard can show. */
export type IntegrationFailure = { ok: false; code: "invalid" | "rejected" | "unavailable" | "not_found" | "no_key"; message: string };
export type IntegrationResult<T> = { ok: true; value: T } | IntegrationFailure;

export interface IntegrationQueries {
  list(websiteId: string): Promise<ProviderView[]>;
  deliveries(websiteId: string, limit: number): Promise<DeliveryView[]>;
}

export interface IntegrationMutations {
  /** Validate, test against the provider, then store. Replaces an existing connection. */
  connect(websiteId: string, provider: string, input: { credentials: unknown; config: unknown }): Promise<IntegrationResult<ConnectionView>>;
  /** Change config or the enabled switch; new credentials, if given, are re-verified. */
  update(websiteId: string, provider: string, input: { enabled?: boolean; config?: unknown; credentials?: unknown }): Promise<IntegrationResult<ConnectionView>>;
  /** Deletes the connection and its stored credentials. False when there was none. */
  disconnect(websiteId: string, provider: string): Promise<boolean>;
  /** Sends a clearly marked sample lead through the connection. */
  sendTest(websiteId: string, provider: string): Promise<IntegrationResult<Outcome>>;
}

export type IntegrationsModule = ModuleLifecycle & {
  queries: IntegrationQueries;
  mutations: IntegrationMutations;
  /** Ages out the delivery log with the rest of a site's history. */
  retention: RetentionPurge;
  routes: AuthedRouter;
};
