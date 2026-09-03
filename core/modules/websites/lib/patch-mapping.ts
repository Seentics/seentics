import type { UpdateWebsiteInput } from "../interfaces";

/**
 * Wire patch (snake_case) → domain patch (camelCase).
 *
 * `websitePatchSchema` is `z.record(z.unknown())`, so the HTTP layer accepts any
 * keys and this is the only place that decides which ones mean anything. Unknown
 * keys are dropped rather than rejected, matching what the endpoint has always
 * done.
 *
 * The `undefined` / `null` distinction is the part to be careful with. For the four
 * nullable pattern columns, `null` means "clear it" and absence means "leave it
 * alone" — so those are checked with `in` and passed through verbatim, while the
 * rest are only copied when non-null. Collapsing the two would make a set pattern
 * impossible to clear.
 */
export function toUpdateWebsiteInput(patch: Record<string, unknown>): UpdateWebsiteInput {
  const out: UpdateWebsiteInput = {};

  if (typeof patch.name === "string") out.name = patch.name;
  if (typeof patch.url === "string") out.url = patch.url;
  if (typeof patch.is_active === "boolean") out.isActive = patch.is_active;
  if (typeof patch.automation_enabled === "boolean") {
    out.automationEnabled = patch.automation_enabled;
  }
  if (typeof patch.funnel_enabled === "boolean") out.funnelEnabled = patch.funnel_enabled;
  if (typeof patch.heatmap_enabled === "boolean") out.heatmapEnabled = patch.heatmap_enabled;
  if (typeof patch.heatmap_layout_enabled === "boolean") {
    out.heatmapLayoutEnabled = patch.heatmap_layout_enabled;
  }
  if (typeof patch.replay_enabled === "boolean") out.replayEnabled = patch.replay_enabled;
  if (typeof patch.replay_sampling_rate === "number") {
    out.replaySamplingRate = patch.replay_sampling_rate;
  }

  // Nullable: `null` clears, absence leaves alone. `in` distinguishes the two.
  if ("heatmap_include_patterns" in patch) {
    out.heatmapIncludePatterns = asNullableString(patch.heatmap_include_patterns);
  }
  if ("heatmap_exclude_patterns" in patch) {
    out.heatmapExcludePatterns = asNullableString(patch.heatmap_exclude_patterns);
  }
  if ("replay_include_patterns" in patch) {
    out.replayIncludePatterns = asNullableString(patch.replay_include_patterns);
  }
  if ("replay_exclude_patterns" in patch) {
    out.replayExcludePatterns = asNullableString(patch.replay_exclude_patterns);
  }

  return out;
}

/** A string stays a string; anything else — including `null` — clears the column. */
function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
