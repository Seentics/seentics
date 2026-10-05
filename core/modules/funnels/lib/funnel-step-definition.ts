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
  if (step.step_type === "event") {
    const event = (step.event_type ?? "").trim();
    return event ? { kind: "event", event } : null;
  }
  const path = (step.page_path ?? "").trim();
  return path ? { kind: "page", path, match: step.match_type ?? "exact" } : null;
}
