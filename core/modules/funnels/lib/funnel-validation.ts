import { MAX_FUNNEL_STEPS } from "../../analytics/interfaces";

/** A funnel the owner sent that cannot be counted. `issues` say what to change. */
export class FunnelValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues[0] ?? "Invalid funnel");
    this.name = "FunnelValidationError";
  }
}

/** Longest a step may wait for the next one: 30 days. */
export const MAX_WINDOW_HOURS = 720;
export const MAX_PATTERN_CHARS = 500;

type StepInput = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * What a funnel definition has to satisfy before it is saved, as messages a person can act on.
 *
 * A step count over the limit or a regular expression the database cannot read would not fail
 * here but later, in the report. Saved quietly, either one meant a funnel that errors every time
 * it is opened; refused at save, the owner is told which step to fix.
 *
 * `isValidPattern` asks the database, because its regular-expression syntax is not
 * JavaScript's: a pattern with a named group or a lookbehind is fine in a browser and not here.
 */
export async function validateFunnelDefinition(
  input: { steps?: StepInput[] | undefined; conversion_window_hours?: unknown },
  isValidPattern: (pattern: string) => Promise<boolean>,
): Promise<string[]> {
  const issues: string[] = [];

  const window = input.conversion_window_hours;
  if (window !== undefined && window !== null) {
    if (typeof window !== "number" || !Number.isInteger(window) || window < 1 || window > MAX_WINDOW_HOURS) {
      issues.push(`The time allowed between steps must be a whole number of hours from 1 to ${MAX_WINDOW_HOURS}, or left empty for no limit.`);
    }
  }

  const steps = input.steps;
  if (steps !== undefined) {
    if (steps.length > MAX_FUNNEL_STEPS) issues.push(`A funnel can have at most ${MAX_FUNNEL_STEPS} steps.`);
    for (const [index, step] of steps.entries()) {
      const type = text(step.step_type ?? step.stepType ?? "page_view");
      const match = text(step.match_type ?? step.matchType ?? "exact");
      const pattern = text(step.page_path ?? step.pagePath ?? step.path);
      if (type === "event" || match !== "regex" || !pattern) continue;
      const label = text(step.name) || `Step ${index + 1}`;
      if (pattern.length > MAX_PATTERN_CHARS) {
        issues.push(`${label}: the pattern can be at most ${MAX_PATTERN_CHARS} characters.`);
      } else if (!(await isValidPattern(pattern))) {
        issues.push(`${label}: "${pattern}" is not a valid regular expression.`);
      }
    }
  }
  return issues;
}
