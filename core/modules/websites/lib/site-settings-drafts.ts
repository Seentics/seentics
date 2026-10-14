import { z } from "zod";
import type { SiteSettingsDraftPort, SiteTrackingSettings, Website, WebsiteMutations, WebsiteQuery } from "../interfaces";
import { websitePatchSchema } from "../validators/website.schema";
import { toUpdateWebsiteInput } from "./patch-mapping";

/** Newline-separated URL patterns; the settings screens keep them well under this. */
const MAX_PATTERNS_CHARS = 4_000;
const patterns = z.string().max(MAX_PATTERNS_CHARS).nullable();

/**
 * The tracking fields `PUT /websites/:id` accepts, typed.
 *
 * That endpoint takes `z.record(z.unknown())` and lets `toUpdateWebsiteInput` pick the keys it
 * knows. A draft is held to more: every key must be one of these, of the right type, so a draft
 * cannot carry a field the mapping would silently drop (and the card would wrongly show).
 */
const trackingPatchSchema = z
  .object({
    automation_enabled: z.boolean(),
    funnel_enabled: z.boolean(),
    errors_enabled: z.boolean(),
    heatmap_enabled: z.boolean(),
    heatmap_layout_enabled: z.boolean(),
    heatmap_include_patterns: patterns,
    heatmap_exclude_patterns: patterns,
    replay_enabled: z.boolean(),
    replay_sampling_rate: z.number().min(0).max(1),
    replay_include_patterns: patterns,
    replay_exclude_patterns: patterns,
    mask_all_text: z.boolean(),
    mask_text_patterns: patterns,
  })
  .partial()
  .strict();

export const SITE_SETTING_KEYS = Object.keys(trackingPatchSchema.shape) as (keyof SiteTrackingSettings)[];

export function trackingSettingsOf(w: Website): SiteTrackingSettings {
  return {
    automation_enabled: w.automationEnabled,
    funnel_enabled: w.funnelEnabled,
    errors_enabled: w.errorsEnabled,
    heatmap_enabled: w.heatmapEnabled,
    heatmap_layout_enabled: w.heatmapLayoutEnabled,
    heatmap_include_patterns: w.heatmapIncludePatterns,
    heatmap_exclude_patterns: w.heatmapExcludePatterns,
    replay_enabled: w.replayEnabled,
    replay_sampling_rate: w.replaySamplingRate,
    replay_include_patterns: w.replayIncludePatterns,
    replay_exclude_patterns: w.replayExcludePatterns,
    mask_all_text: w.maskAllText,
    mask_text_patterns: w.maskTextPatterns,
  };
}

/** `SiteSettingsDraftPort` over the uncached website read and the settings mutation. */
export class SiteSettingsDraftService implements SiteSettingsDraftPort {
  constructor(
    private readonly websites: Pick<WebsiteQuery, "getById">,
    private readonly mutations: Pick<WebsiteMutations, "update">,
  ) {}

  async current(websiteId: string) {
    const w = await this.websites.getById(websiteId);
    if (!w) return null;
    return { settings: trackingSettingsOf(w), version: new Date(w.updatedAt).toISOString() };
  }

  validatePatch(patch: unknown): { ok: true; patch: Partial<SiteTrackingSettings> } | { ok: false; error: string } {
    // The endpoint's own schema, then the typed subset.
    const outer = websitePatchSchema.safeParse(patch);
    if (!outer.success) return { ok: false, error: "The change must be an object of settings." };
    const parsed = trackingPatchSchema.safeParse(outer.data);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`).join("; ") };
    }
    const out: Partial<SiteTrackingSettings> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      // An empty pattern list is "no patterns", which the column stores as null.
      (out as Record<string, unknown>)[k] = typeof v === "string" && !v.trim() ? null : v;
    }
    if (!Object.keys(out).length) return { ok: false, error: "The change has nothing to change." };
    return { ok: true, patch: out };
  }

  async applyFromProposal(input: { websiteId: string; payload: unknown }): Promise<{ id: string }> {
    const checked = this.validatePatch(input.payload);
    if (!checked.ok) throw new Error(`The approved settings change is not valid: ${checked.error}`);
    // The endpoint's mapping, the endpoint's mutation: same cache invalidation, same log line.
    const updated = await this.mutations.update(input.websiteId, toUpdateWebsiteInput(checked.patch as Record<string, unknown>));
    if (!updated) throw new Error("That website no longer exists.");
    return { id: input.websiteId };
  }
}
