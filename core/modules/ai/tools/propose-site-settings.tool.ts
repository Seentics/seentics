import { z } from "zod";
import type { SiteSettingsDraftPort, SiteTrackingSettings } from "../../websites/interfaces";
import { diffFields, drafted, proposal, refuse } from "./proposal-policy";
import type { AiTool, ProposalRisk, ToolResult } from "./tool.types";

/**
 * `get_site_settings` and `propose_site_settings`: what this site collects, and a change to it.
 *
 * Only settings the website settings screens already edit, through `PUT /websites/:id`'s own
 * patch mapping (the websites module's `SiteSettingsDraftPort`). Admin or owner to confirm, as on
 * that endpoint. Every change says, in a sentence, what it does to the data collected — that is
 * the part a person approving it most needs to read.
 */

const LABELS: ReadonlyArray<readonly [keyof SiteTrackingSettings, string]> = [
  ["replay_enabled", "Session recordings"],
  ["replay_sampling_rate", "Sessions recorded"],
  ["replay_include_patterns", "Record only pages matching"],
  ["replay_exclude_patterns", "Never record pages matching"],
  ["heatmap_enabled", "Heatmaps"],
  ["heatmap_layout_enabled", "Heatmap page snapshots"],
  ["heatmap_include_patterns", "Heatmaps only on pages matching"],
  ["heatmap_exclude_patterns", "No heatmaps on pages matching"],
  ["mask_all_text", "Mask all text in recordings and snapshots"],
  ["mask_text_patterns", "Mask text on pages matching"],
  ["errors_enabled", "Error tracking"],
  ["funnel_enabled", "Funnel tracking"],
  ["automation_enabled", "Automations"],
];

const PATTERN_KEYS = new Set<keyof SiteTrackingSettings>([
  "replay_include_patterns", "replay_exclude_patterns", "heatmap_include_patterns", "heatmap_exclude_patterns", "mask_text_patterns",
]);

/** Newline-separated patterns as a list; null and empty are no patterns. */
export function patternList(v: string | null | undefined): string[] {
  return (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const list = (xs: string[]) => xs.join(", ");

/**
 * The privacy and data impact of each changed setting, in plain sentences. Exported for tests.
 * Each names what starts or stops being collected or shown, e.g. "Recordings will start capturing /checkout".
 */
export function dataImpact(before: SiteTrackingSettings, patch: Partial<SiteTrackingSettings>): ProposalRisk[] {
  const out: ProposalRisk[] = [];
  const data = (message: string) => out.push({ kind: "data", message });
  const has = (k: keyof SiteTrackingSettings) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(before[k]);

  if (has("replay_enabled")) {
    data(patch.replay_enabled
      ? `Recordings will start capturing visitor sessions (${pct(patch.replay_sampling_rate ?? before.replay_sampling_rate)} of them).`
      : "Recordings will stop. Existing recordings are kept.");
  }
  if (has("replay_sampling_rate")) {
    const a = patch.replay_sampling_rate!;
    data(`Recordings will capture ${pct(a)} of sessions (was ${pct(before.replay_sampling_rate)}).`);
  }
  const patterns = (k: keyof SiteTrackingSettings, what: string, include: boolean) => {
    if (!has(k)) return;
    const b = patternList(before[k] as string | null);
    const a = patternList(patch[k] as string | null);
    const added = a.filter((p) => !b.includes(p));
    const removed = b.filter((p) => !a.includes(p));
    if (include) {
      if (!a.length) data(`${what} will capture every page again, not only ${list(b)}.`);
      else if (!b.length) data(`${what} will capture only ${list(a)}; every other page stops.`);
      else {
        if (added.length) data(`${what} will start capturing ${list(added)}.`);
        if (removed.length) data(`${what} will stop capturing ${list(removed)}.`);
      }
    } else {
      if (removed.length) data(`${what} will start capturing ${list(removed)}.`);
      if (added.length) data(`${what} will stop capturing ${list(added)}.`);
    }
  };
  patterns("replay_include_patterns", "Recordings", true);
  patterns("replay_exclude_patterns", "Recordings", false);
  if (has("heatmap_enabled")) data(patch.heatmap_enabled ? "Heatmaps will start collecting clicks and scrolling." : "Heatmaps will stop collecting. Existing heatmaps are kept.");
  if (has("heatmap_layout_enabled")) {
    data(patch.heatmap_layout_enabled ? "Heatmaps will store snapshots of your pages' layout." : "Heatmaps will stop storing page snapshots.");
  }
  patterns("heatmap_include_patterns", "Heatmaps", true);
  patterns("heatmap_exclude_patterns", "Heatmaps", false);
  if (has("mask_all_text")) {
    data(patch.mask_all_text
      ? "All text in recordings and heatmap snapshots will be masked."
      : "Text in recordings and heatmap snapshots will no longer be masked everywhere: they may show what visitors type and see, including personal data.");
  }
  if (has("mask_text_patterns")) {
    const b = patternList(before.mask_text_patterns);
    const a = patternList(patch.mask_text_patterns);
    const unmasked = b.filter((p) => !a.includes(p));
    const masked = a.filter((p) => !b.includes(p));
    if (unmasked.length) data(`Text on ${list(unmasked)} will no longer be masked in recordings and snapshots.`);
    if (masked.length) data(`Text on ${list(masked)} will be masked in recordings and snapshots.`);
  }
  if (has("errors_enabled")) data(patch.errors_enabled ? "Frontend errors will start being collected." : "Frontend errors will stop being collected.");
  if (has("funnel_enabled")) data(patch.funnel_enabled ? "Funnel tracking will start." : "Funnel tracking will stop.");
  if (has("automation_enabled")) {
    out.push(patch.automation_enabled
      ? { kind: "live", message: "Automations will run for visitors again — every active one goes live immediately." }
      : { kind: "stops", message: "Every automation on this site will stop running for visitors." });
  }
  return out;
}

const patterns = z.string().max(4000).describe("Newline-separated URL patterns; an empty string clears them");

const patchSchema = z.object({
  replay_enabled: z.boolean().optional(),
  replay_sampling_rate: z.number().min(0).max(1).optional().describe("Share of sessions recorded, 0 to 1"),
  replay_include_patterns: patterns.optional(),
  replay_exclude_patterns: patterns.optional(),
  heatmap_enabled: z.boolean().optional(),
  heatmap_layout_enabled: z.boolean().optional(),
  heatmap_include_patterns: patterns.optional(),
  heatmap_exclude_patterns: patterns.optional(),
  mask_all_text: z.boolean().optional(),
  mask_text_patterns: patterns.optional(),
  errors_enabled: z.boolean().optional(),
  funnel_enabled: z.boolean().optional(),
  automation_enabled: z.boolean().optional(),
});

type Args = { patch: z.infer<typeof patchSchema> };

const shown = (k: keyof SiteTrackingSettings, v: unknown): unknown =>
  PATTERN_KEYS.has(k) ? patternList(v as string | null) : k === "replay_sampling_rate" ? pct(v as number) : v;

export function siteSettingsTools(port: SiteSettingsDraftPort): AiTool<any>[] {
  const getTool: AiTool<Record<string, never>> = {
    name: "get_site_settings",
    kind: "read",
    description:
      "This website's collection settings: recordings (on/off, share of sessions, page patterns), heatmaps, text " +
      "masking, error, funnel and automation tracking. Call before drafting a settings change.",
    schema: z.object({}) as unknown as z.ZodType<Record<string, never>>,
    async handler(_a, ctx): Promise<ToolResult> {
      const cur = await port.current(ctx.websiteId);
      return cur ? { ok: true, data: { data: cur.settings } } : refuse("This website was not found.");
    },
  };

  const proposeTool: AiTool<Args> = {
    name: "propose_site_settings",
    kind: "propose",
    description:
      "Draft a change to this website's collection settings (only the fields listed) for an owner or admin to " +
      "confirm. Changes nothing until confirmed. Call get_site_settings first; send only the fields that change, " +
      "and for pattern lists the whole new list.",
    schema: z.object({ patch: patchSchema }) as unknown as z.ZodType<Args>,
    async handler(args, ctx): Promise<ToolResult> {
      const cur = await port.current(ctx.websiteId);
      if (!cur) return refuse("This website was not found.");
      const checked = port.validatePatch(args.patch);
      if (!checked.ok) return refuse(`That change is not valid: ${checked.error}`);

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const [k] of LABELS) {
        before[k] = shown(k, cur.settings[k]);
        if (k in checked.patch) after[k] = shown(k, checked.patch[k]);
      }
      const diff = diffFields(LABELS, before, after);
      if (!diff.length) return refuse("Those are already the settings. Nothing to change.");
      // Only the fields that actually change are applied.
      const payload = Object.fromEntries(diff.map((d) => [d.field, checked.patch[d.field as keyof SiteTrackingSettings]]));
      const risks = dataImpact(cur.settings, payload as Partial<SiteTrackingSettings>);

      return drafted(proposal({
        resource: "site_settings",
        operation: "update",
        target: { id: ctx.websiteId, version: cur.version },
        payload,
        diff,
        summary: {
          title: "Change what this site collects",
          lines: risks.map((r) => r.message),
          hasExternalEffect: false,
          risks,
        },
      }));
    },
  };

  return [getTool, proposeTool];
}
