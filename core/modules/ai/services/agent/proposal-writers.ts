import type { AutomationDraftWriter } from "../../../automations/interfaces/automations.module";
import type { ErrorMutations, ErrorQueries } from "../../../errors/interfaces";
import type { FunnelDraftPort } from "../../../funnels/interfaces";
import type { GoalDraftPort, SiteSettingsDraftPort } from "../../../websites/interfaces";
import type { AnomalyService } from "../../anomalies/service";
import { SENSITIVITIES, type AlertSettings } from "../../anomalies/types";
import type { RecommendationService } from "../../recommendations/service";
import { UUID } from "../../tools/proposal-policy";
import type { ProposalWriters, ResourceWriter } from "./proposal-applier";

/**
 * Every write an approved AI draft can make, by resource and operation — the whole list.
 *
 * Each goes through the owning module's port (or, for alerts and recommendations, this module's
 * own service), which re-validates the stored payload with the schema its regular endpoint uses.
 * Nothing here deletes: "archive" is not offered for any resource, because none of these has a
 * soft-archive state beyond the on/off switch that `setStatus` already covers.
 *
 * Versions are what the matching draft tool recorded: `updated_at` for automations, funnels,
 * goals and the site; the status for an error group and a recommendation (their `updated_at` /
 * `last_seen_at` move on their own, and a draft about their status only goes stale when the
 * status does); the values for alert settings, which have no row until first saved.
 */
export function proposalWriters(ports: {
  automations: AutomationDraftWriter;
  funnels?: FunnelDraftPort;
  goals: GoalDraftPort;
  siteSettings: SiteSettingsDraftPort;
  errors: { queries: Pick<ErrorQueries, "getGroup">; mutations: ErrorMutations };
  alerts?: AnomalyService | null;
  recommendations?: RecommendationService | null;
}): ProposalWriters {
  const writers: ProposalWriters = {
    automation: {
      create: (i) => ports.automations.createFromProposal(i),
      version: async (websiteId, id) => (UUID.test(id) ? (await ports.automations.get(websiteId, id))?.version ?? null : null),
      update: (i) => ports.automations.updateFromProposal({ websiteId: i.websiteId, automationId: i.id, payload: i.payload }),
      setStatus: (i) => ports.automations.setActiveFromProposal({ websiteId: i.websiteId, automationId: i.id, active: activeOf(i.payload) }),
    },
    goal: {
      create: ({ websiteId, payload }) => ports.goals.createFromProposal({ websiteId, payload }),
      version: async (websiteId, id) => (UUID.test(id) ? (await ports.goals.get(websiteId, id))?.version ?? null : null),
      update: (i) => ports.goals.updateFromProposal({ websiteId: i.websiteId, goalId: i.id, payload: i.payload }),
    },
    error: {
      version: async (websiteId, fingerprint) =>
        (await ports.errors.queries.getGroup(websiteId, fingerprint, { days: 1, limit: 1 })).group?.status ?? null,
      setStatus: async (i) => {
        const status = (i.payload as { status?: unknown } | null)?.status;
        if (status !== "resolved" && status !== "ignored" && status !== "unresolved") {
          throw new Error("The approved change has no valid status.");
        }
        if (!(await ports.errors.mutations.setStatus(i.websiteId, i.id, status))) {
          throw new Error("That error no longer exists on this website.");
        }
        return { id: i.id };
      },
    },
    site_settings: {
      // The target is the website itself: an id other than the URL's is not this site.
      version: async (websiteId, id) => (id === websiteId ? (await ports.siteSettings.current(websiteId))?.version ?? null : null),
      update: ({ websiteId, payload }) => ports.siteSettings.applyFromProposal({ websiteId, payload }),
    },
  };

  if (ports.funnels) {
    const funnels = ports.funnels;
    writers.funnel = {
      create: (i) => funnels.createFromProposal(i),
      version: async (websiteId, id) => (UUID.test(id) ? (await funnels.get(websiteId, id))?.version ?? null : null),
      update: (i) => funnels.updateFromProposal({ websiteId: i.websiteId, funnelId: i.id, payload: i.payload }),
      setStatus: (i) => funnels.setActiveFromProposal({ websiteId: i.websiteId, funnelId: i.id, active: activeOf(i.payload) }),
    };
  }

  if (ports.recommendations) {
    const recs = ports.recommendations;
    writers.recommendation = {
      version: async (websiteId, id) => (UUID.test(id) ? (await recs.get(websiteId, id))?.status ?? null : null),
      setStatus: async (i) => {
        const status = (i.payload as { status?: unknown } | null)?.status;
        const row = status === "dismissed"
          ? await recs.dismiss(i.websiteId, i.id)
          : status === "applied_manual"
            ? await recs.markDone(i.websiteId, i.id, i.userId)
            : (() => { throw new Error("The approved change has no valid status."); })();
        if (!row) throw new Error("That suggestion is no longer open.");
        return { id: i.id };
      },
    };
  }

  if (ports.alerts) {
    const alerts = ports.alerts;
    writers.alert_settings = {
      version: async (websiteId, id) => (id === websiteId ? alertSettingsVersion(await alerts.settings(websiteId)) : null),
      update: async (i) => {
        const p = (i.payload ?? {}) as Partial<AlertSettings>;
        const next: Partial<AlertSettings> = {};
        if (typeof p.enabled === "boolean") next.enabled = p.enabled;
        if (typeof p.sensitivity === "string" && (SENSITIVITIES as readonly string[]).includes(p.sensitivity)) next.sensitivity = p.sensitivity;
        if (!Object.keys(next).length) throw new Error("The approved change has nothing to change.");
        await alerts.saveSettings(i.websiteId, { ...(await alerts.settings(i.websiteId)), ...next }, i.userId);
        return { id: i.websiteId };
      },
    };
    writers.alert_snooze = {
      create: async (i) => {
        const p = (i.payload ?? {}) as { anomalyId?: unknown; type?: unknown; subject?: unknown; hours?: unknown };
        let scope = { type: String(p.type ?? "*"), subject: String(p.subject ?? "*") };
        if (typeof p.anomalyId === "string") {
          // Re-read: the anomaly must still be this site's, and its key is what is snoozed.
          const found = UUID.test(p.anomalyId) ? await alerts.snoozeScopeOf(i.websiteId, p.anomalyId) : null;
          if (!found) throw new Error("That alert no longer exists on this website.");
          scope = found;
        }
        const saved = await alerts.snooze(i.websiteId, scope, Number(p.hours), i.userId);
        return { id: `${saved.type}:${saved.subject}` };
      },
    };
  }

  return writers;
}

/** The version of a site's alert settings: their values (there may be no row to date). */
export function alertSettingsVersion(s: AlertSettings): string {
  return `${s.enabled ? "on" : "off"}:${s.sensitivity}`;
}

function activeOf(payload: unknown): boolean {
  const active = (payload as { active?: unknown } | null)?.active;
  if (typeof active !== "boolean") throw new Error("The approved change does not say on or off.");
  return active;
}

export type { ResourceWriter };
