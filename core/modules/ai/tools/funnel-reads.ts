import type { FunnelPerformance, FunnelReport } from "../../funnels/interfaces";

/** A funnel definition as the fixed SQL read returns it: `steps` is the raw JSONB. */
type FunnelRow = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Step names in order, from JSONB that may hold anything. */
function stepNames(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((s, i) => {
    const name = (s as { name?: unknown } | null)?.name;
    return typeof name === "string" && name.trim() ? name.trim() : `Step ${i + 1}`;
  });
}

/**
 * The funnel reads the assistant sees: definitions from the fixed SQL, figures from the funnels
 * module's own report, so the numbers are the ones the funnel page shows.
 *
 * Shaped for the model rather than passed through: names and counts, no ids it does not need,
 * no step JSON. Every token here is paid for on each turn that replays it.
 */
export function funnelReads(deps: {
  /** Definitions for one website (`sqlBackedReads.funnels`). */
  definitions: (websiteId: string) => Promise<FunnelRow[]>;
  performance: FunnelPerformance;
}) {
  return {
    /**
     * Every funnel with its headline conversion over `days`. The figures are one aggregation for
     * all funnels; if it fails the list still comes back, just without them.
     */
    funnels: async (websiteId: string, days: number) => {
      const [rows, reports] = await Promise.all([
        deps.definitions(websiteId),
        deps.performance.reports(websiteId, days).catch(() => null),
      ]);
      return rows.map((f) => {
        const report = reports?.[String(f.id)];
        return {
          id: String(f.id),
          name: String(f.name ?? ""),
          active: f.is_active !== false,
          steps: stepNames(f.steps).join(" → "),
          ...(report
            ? { entries: report.totalEntries, completions: report.completions, conversion_rate: report.conversionRate }
            : {}),
        };
      });
    },

    /** One funnel's step-by-step figures over `days`. Throws a message the model can relay. */
    funnelPerformance: async (websiteId: string, funnelId: string, days: number) => {
      // Model-supplied: checked before it reaches a uuid column, where a malformed one is a
      // database error rather than "not found".
      if (!UUID.test(funnelId)) throw new Error("Not a funnel id. Call list_funnels to find it.");
      const [rows, report] = await Promise.all([
        deps.definitions(websiteId),
        deps.performance.report(websiteId, funnelId, days),
      ]);
      if (!report) throw new Error("No funnel with that id on this website. Call list_funnels.");
      // The definitions read is capped, so a site with very many funnels may not list this one.
      const def = rows.find((f) => String(f.id) === funnelId);
      return compactReport(String(def?.name ?? ""), days, report);
    },
  };
}

/** `conversion_rate` and `dropoff_rate` are percentages, as the funnel page shows them. */
export function compactReport(name: string, days: number, report: FunnelReport) {
  return {
    name,
    days,
    entries: report.totalEntries,
    completions: report.completions,
    conversion_rate: report.conversionRate,
    steps: report.stepBreakdown.map((s) => ({
      name: s.stepName,
      count: s.count,
      dropoff: s.dropoffCount,
      dropoff_rate: s.dropoffRate,
    })),
    ...(report.warnings?.length ? { warnings: report.warnings } : {}),
  };
}
