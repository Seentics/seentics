import type { FunnelProgressStep } from "../../analytics/interfaces";
import type { FunnelStep } from "../interfaces";

/**
 * A stored funnel step, as the query that counts visitors understands it.
 *
 * A step with nothing to match (a page step with no path, an event step with no event name)
 * becomes `null`: it can never be reached, and the report says so by counting nobody there
 * rather than by guessing.
 */
export function toProgressStep(step: FunnelStep): FunnelProgressStep | null {
  // Steps are stored JSON: one saved before steps were validated can hold a number where a
  // string belongs, and `.trim()` on it threw — failing the stats of every funnel on the site.
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  if (step.step_type === "event") {
    const event = str(step.event_type);
    return event ? { kind: "event", event } : null;
  }
  const path = str(step.page_path);
  return path ? { kind: "page", path, match: step.match_type ?? "exact" } : null;
}
