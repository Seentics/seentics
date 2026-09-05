
/**
 * The server-side evaluation path.
 *
 * Kept apart from the dashboard interfaces because the caller is completely
 * different: the tracker, unauthenticated, on the ingest edge, once per trigger
 * per visitor. It is the only automations surface with externally-visible side
 * effects (it sends webhooks), so the narrower its contract the better.
 */

/**
 * A trigger the tracker observed, plus everything needed to judge it.
 *
 * Both website identifiers are required and both must already be resolved. The
 * caller is a route that has just looked the website up in order to validate the
 * request origin, so it has both to hand — asking it to pass them removes the
 * only reason this module would otherwise have to read the `websites` table.
 *
 * Getting the two the wrong way round silently matches nothing rather than
 * failing, so:
 * - `websiteId` is `websites.id`, the UUID that keys `automations`,
 *   `automation_impressions` and `user_profiles`.
 * - `websiteId` is `websites.website_id`, the short public id, used only to label
 *   published events (every event payload in `EventMap` is keyed by `websiteId`).
 */
export interface EvaluateRequest {
  /** Website **UUID**. Keys every table this path reads or writes. */
  websiteId: string;
  anonymousId: string;
  userId?: string | null;
  sessionId: string;
  trigger: {
    type: string;
    [key: string]: unknown;
  };
  context: Record<string, unknown>;
}

/** One action for the tracker to perform in the browser. */
export interface ClientAction {
  type: string;
  automation_id: string;
  variant?: string | null;
  run_id: string;
  [key: string]: unknown;
}

export interface EvaluateResult {
  /** How many automations fired. Webhook actions count here but are not returned. */
  matched: number;
  actions: ClientAction[];
}

/** Facts an `identify` call carries about a visitor. */
export interface IdentifyPayload {
  /** Website **UUID** — `user_profiles.website_id` is a uuid column. */
  websiteId: string;
  anonymousId: string;
  userId?: string | null;
  properties?: Record<string, unknown>;
  meta?: {
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
  };
}

/** Decide which automations fire for a trigger, and fire them. */
export interface AutomationEvaluation {
  /**
   * Evaluate every active automation against one trigger.
   *
   * Webhook actions are dispatched fire-and-forget; client actions come back in
   * the result. Never throws for a per-automation failure — one broken webhook
   * or one unparseable definition must not cost the visitor the other
   * automations on the page.
   */
  evaluate(request: EvaluateRequest): Promise<EvaluateResult>;
}

