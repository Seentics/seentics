import type { Funnel, TrackerFunnel } from "../interfaces";

/** The step fields the tracker matches a page view or an event against (seentics.js). */
const STEP_FIELDS = ["id", "name", "order", "step_type", "page_path", "path", "match_type", "match", "pattern", "event_type", "event"] as const;

/**
 * Active funnels as every visitor's browser gets them: the id and name it reports progress
 * under, and each step's matching rule. Nothing else — the owner's id, the internal description
 * and the funnel's live conversion numbers were all in this public answer.
 */
export function trackerFunnel(funnel: Funnel): TrackerFunnel {
  const steps = Array.isArray(funnel.steps) ? funnel.steps : [];
  return {
    id: funnel.id,
    name: funnel.name,
    steps: steps.map((step) => {
      const out: Record<string, unknown> = {};
      for (const key of STEP_FIELDS) {
        const value = (step as Record<string, unknown>)[key];
        if (value !== undefined && value !== null) out[key] = value;
      }
      return out;
    }),
  };
}
