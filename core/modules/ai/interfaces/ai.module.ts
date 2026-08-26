import type { AuthedRouter } from "../../../platform/http/router";
import type { UsageCounter } from "../../../platform/usage";

/**
 * Everything the AI module offers: its routes, and nothing else.
 *
 * AI is purely a consumer — it reads through other modules' query surfaces and
 * exposes no capability anything else needs. The interface exists anyway so the
 * composition root names a type rather than a class, and so adding a capability later
 * is a change to this file rather than to the root.
 */
export interface AiModule {
  /** This module's contribution to the per-user usage report. */
  usage: UsageCounter;

  routes: AuthedRouter;
}
