import { z } from "zod";
import type { ErrorQueries } from "../../errors/interfaces";
import type { AlertView } from "../anomalies/present";
import { ANOMALY_TYPES, MAX_SNOOZE_HOURS, SENSITIVITIES, SNOOZE_ANY, type AlertSettings, type AlertSnooze, type AnomalyType, type Sensitivity } from "../anomalies/types";
import { alertSettingsVersion } from "../services/agent/proposal-writers";
import { UUID, diffLines, drafted, proposal, refuse } from "./proposal-policy";
import type { RecommendationReadPorts } from "./recommendation-reads";
import type { AiTool, ProposalChange, ToolResult } from "./tool.types";

/**
 * Triage drafts: an error group's status, a recommendation's status, the site's alert settings and
 * alert snoozes. Plus `list_alerts`, the read the alert drafts need.
 *
 * Each reads the target's current state here (never from the model), so the draft records what it
 * changes from, and the confirm step refuses it once that has moved.
 */

export type AlertPorts = {
  list(websiteId: string, status: "open" | "all"): Promise<AlertView[]>;
  get(websiteId: string, id: string): Promise<AlertView | null>;
  settings(websiteId: string): Promise<AlertSettings>;
  snoozes(websiteId: string): Promise<AlertSnooze[]>;
};

const ERROR_STATUS_TEXT: Record<string, string> = {
  resolved: "Marked resolved: it leaves the open list, and comes back if it happens again.",
  ignored: "Ignored: it is hidden from the open list and from error-surge alerts.",
  unresolved: "Back in the open list.",
};

const TYPE_LABEL: Record<AnomalyType, string> = {
  traffic_drop: "traffic drop",
  traffic_spike: "traffic spike",
  tracking_outage: "tracking outage",
  error_surge: "error surge",
  conversion_drop: "conversion drop",
};

const untilText = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

export function errorTriageTool(errors: Pick<ErrorQueries, "getGroup">): AiTool<{ fingerprint: string; status: "resolved" | "ignored" | "unresolved" }> {
  return {
    name: "propose_error_status",
    kind: "propose",
    description:
      "Draft marking a frontend error group resolved, ignored or unresolved, for the user to confirm. " +
      "Changes nothing until confirmed. Use the error_fingerprint from list_error_groups.",
    schema: z.object({
      fingerprint: z.string().trim().min(1).max(128).describe("error_fingerprint from list_error_groups"),
      status: z.enum(["resolved", "ignored", "unresolved"]),
    }),
    async handler(args, ctx): Promise<ToolResult> {
      const { group } = await errors.getGroup(ctx.websiteId, args.fingerprint, { days: 1, limit: 1 });
      if (!group) return refuse("No error with that fingerprint on this website. Call list_error_groups.");
      if (group.status === args.status) return refuse(`That error is already ${group.status}.`);
      const diff: ProposalChange[] = [{ field: "status", label: "Status", before: group.status, after: args.status }];
      return drafted(proposal({
        resource: "error",
        operation: "set_status",
        target: { id: group.fingerprint, version: group.status },
        payload: { status: args.status },
        diff,
        summary: {
          title: group.message.slice(0, 120) || "Error",
          lines: [...diffLines(diff), `${group.event_count} occurrences; last on ${group.last_page_path || "an unknown page"}.`, ERROR_STATUS_TEXT[args.status]!],
          hasExternalEffect: false,
        },
      }));
    },
  };
}

export function recommendationTriageTool(recs: Pick<RecommendationReadPorts, "get">): AiTool<{ id: string; status: "dismissed" | "applied_manual" }> {
  return {
    name: "propose_recommendation_status",
    kind: "propose",
    description:
      "Draft dismissing an open suggestion, or marking it done by hand (applied_manual: the user made the change " +
      "themselves, and its impact is then measured), for the user to confirm. Ids from list_recommendations.",
    schema: z.object({
      id: z.string().trim().min(1).max(64).describe("Recommendation id from list_recommendations"),
      status: z.enum(["dismissed", "applied_manual"]),
    }),
    async handler(args, ctx): Promise<ToolResult> {
      if (!UUID.test(args.id)) return refuse("Not a recommendation id. Call list_recommendations to find it.");
      const r = await recs.get(ctx.websiteId, args.id);
      if (!r) return refuse("No recommendation with that id on this website. Call list_recommendations.");
      if (r.status !== "open" && r.status !== "expired") return refuse(`That suggestion is ${r.status}, not open: there is nothing to change.`);
      const after = args.status === "dismissed" ? "dismissed" : "applied";
      const diff: ProposalChange[] = [{ field: "status", label: "Status", before: r.status, after }];
      return drafted(proposal({
        resource: "recommendation",
        operation: "set_status",
        target: { id: r.id, version: r.status },
        payload: { status: args.status },
        diff,
        summary: {
          title: r.title,
          lines: [
            ...diffLines(diff),
            args.status === "dismissed"
              ? "Put away; it is not suggested again for a while."
              : "Recorded as done by you. Its impact is measured 7 and 14 days from now.",
          ],
          hasExternalEffect: false,
        },
      }));
    },
  };
}

export function alertTools(alerts: AlertPorts): AiTool<any>[] {
  const listTool: AiTool<Record<string, never>> = {
    name: "list_alerts",
    kind: "read",
    description:
      "Anomaly alerts on this website (traffic drops and spikes, tracking outages, error surges, conversion drops): " +
      "open ones and the last two weeks' resolved ones, with ids, plus the alert settings and any snoozes.",
    schema: z.object({}) as unknown as z.ZodType<Record<string, never>>,
    async handler(_a, ctx): Promise<ToolResult> {
      const [list, settings, snoozes] = await Promise.all([alerts.list(ctx.websiteId, "all"), alerts.settings(ctx.websiteId), alerts.snoozes(ctx.websiteId)]);
      return {
        ok: true,
        data: {
          data: {
            alerts: list.map((a) => ({
              id: a.id, type: a.type, severity: a.severity, status: a.status, title: a.title,
              detected_at: a.detectedAt, ...(a.snoozedUntil ? { snoozed_until: a.snoozedUntil } : {}),
            })),
            settings,
            snoozes,
          },
        },
      };
    },
  };

  type SettingsArgs = { enabled?: boolean; sensitivity?: Sensitivity };
  const settingsTool: AiTool<SettingsArgs> = {
    name: "propose_alert_settings",
    kind: "propose",
    description:
      "Draft turning this site's anomaly alerts on or off, or changing their sensitivity (low, normal, high), " +
      "for an owner or admin to confirm. Changes nothing until confirmed.",
    schema: z.object({
      enabled: z.boolean().optional(),
      sensitivity: z.enum(SENSITIVITIES).optional().describe("high: more alerts and emails, smaller changes; low: only big ones"),
    }) as unknown as z.ZodType<SettingsArgs>,
    async handler(args, ctx): Promise<ToolResult> {
      const current = await alerts.settings(ctx.websiteId);
      const diff: ProposalChange[] = [];
      if (args.enabled !== undefined && args.enabled !== current.enabled) {
        diff.push({ field: "enabled", label: "Alerts", before: current.enabled ? "on" : "off", after: args.enabled ? "on" : "off" });
      }
      if (args.sensitivity !== undefined && args.sensitivity !== current.sensitivity) {
        diff.push({ field: "sensitivity", label: "Sensitivity", before: current.sensitivity, after: args.sensitivity });
      }
      if (!diff.length) return refuse("Those are already the alert settings. Nothing to change.");
      const payload: SettingsArgs = {};
      for (const d of diff) (payload as Record<string, unknown>)[d.field] = args[d.field as keyof SettingsArgs];
      const turningOff = payload.enabled === false;
      return drafted(proposal({
        resource: "alert_settings",
        operation: "update",
        target: { id: ctx.websiteId, version: alertSettingsVersion(current) },
        payload,
        diff,
        summary: {
          title: "Change anomaly alert settings",
          lines: diffLines(diff),
          hasExternalEffect: false,
          risks: [{
            kind: "alerts",
            message: turningOff
              ? "Nobody on this site is emailed about anomalies any more, and open alerts close."
              : payload.sensitivity
                ? `Changes when everyone with access to this site is emailed (sensitivity ${payload.sensitivity}).`
                : "Everyone with access to this site is emailed about anomalies again.",
          }],
        },
      }));
    },
  };

  type SnoozeArgs = { anomalyId?: string; type?: AnomalyType; hours: number };
  const snoozeTool: AiTool<SnoozeArgs> = {
    name: "propose_alert_snooze",
    kind: "propose",
    description:
      "Draft snoozing anomaly alerts for a number of hours (at most a week): one alert (anomalyId from list_alerts, " +
      "which also covers it reopening), every alert of one type, or all alerts when neither is given. While snoozed " +
      "they are still recorded but not emailed or shown in the dashboard banner. For an owner or admin to confirm.",
    schema: z.object({
      anomalyId: z.string().trim().min(1).max(64).optional(),
      type: z.enum(ANOMALY_TYPES).optional(),
      hours: z.number().int().min(1).max(MAX_SNOOZE_HOURS),
    }) as unknown as z.ZodType<SnoozeArgs>,
    async handler(args, ctx): Promise<ToolResult> {
      let what: string;
      let payload: Record<string, unknown>;
      if (args.anomalyId) {
        if (!UUID.test(args.anomalyId)) return refuse("Not an alert id. Call list_alerts to find it.");
        const a = await alerts.get(ctx.websiteId, args.anomalyId);
        if (!a) return refuse("No alert with that id on this website. Call list_alerts.");
        what = `"${a.title}"`;
        payload = { anomalyId: a.id, hours: args.hours };
      } else if (args.type) {
        what = `every ${TYPE_LABEL[args.type]} alert`;
        payload = { type: args.type, subject: SNOOZE_ANY, hours: args.hours };
      } else {
        what = "every anomaly alert";
        payload = { type: SNOOZE_ANY, subject: SNOOZE_ANY, hours: args.hours };
      }
      const until = new Date(Date.now() + args.hours * 3_600_000).toISOString();
      return drafted(proposal({
        resource: "alert_snooze",
        operation: "create",
        payload,
        summary: {
          title: `Snooze ${what} for ${args.hours} hour${args.hours === 1 ? "" : "s"}`,
          lines: [`Until about ${untilText(until)}, counted from when you confirm.`, "Still detected and listed on the alerts page; just not emailed or shown in the banner."],
          hasExternalEffect: false,
          risks: [{ kind: "alerts", message: `Nobody on this site is emailed about ${what} until the snooze ends.` }],
        },
      }));
    },
  };

  return [listTool, settingsTool, snoozeTool];
}
