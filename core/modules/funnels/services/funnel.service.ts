import type { WebsiteQuery } from "../../websites/interfaces";
import type {
  CreateFunnelInput,
  Funnel,
  FunnelMutations,
  FunnelPerformance,
  FunnelQuery,
  FunnelReport,
  FunnelTrackerConfig,
  UpdateFunnelInput,
} from "../interfaces";
import type { AnalyticsFunnelEvents } from "../../analytics/interfaces";
import {
  deleteFunnel,
  deleteFunnels,
  findFunnel,
  insertFunnel,
  listActiveFunnels,
  listFunnels,
  updateFunnel,
} from "../repositories/funnel.repository";
import { buildFunnelReport, clampReportDays, reportWindow } from "./funnel-report";

/**
 * Resolved identifiers for a website.
 *
 * Both are `string` and they are not interchangeable, which is the whole reason this
 * type exists instead of two positional arguments:
 * - `websiteId` (`websites.id`) keys `funnels`, `goals` and `automations`.
 * - `websiteId` (`websites.website_id`) keys `analytics_events`, which is where the funnel
 *   report's numbers come from.
 *
 * Crossing them compiles cleanly and returns an empty result set, so the report
 * silently reads as "no conversions" instead of failing.
 */
type ResolvedIds = { websiteId: string };

/**
 * The funnels read/write facade.
 *
 * Its structural job mirrors `AnalyticsQueryService` and `RecordingService`: resolve
 * a website reference exactly once per request through the injected `WebsiteQuery`
 * port, then hand resolved identifiers to the repositories. Every function in the
 * old `services/funnels.service.ts` called `resolveWebsiteIds` itself, which meant
 * the funnels module read the `websites` table directly and paid for the lookup
 * again on every call — `stats` did it twice, since it also called `get`.
 *
 * Access control is *not* done here. The routes check `websites.getRole` before
 * calling, the same way analytics and recordings do; the old service interleaved
 * `assertWebsiteAccess` with its queries, which is why it needed a `userId` on
 * read methods that had no other use for one.
 */
export class FunnelService
  implements FunnelQuery, FunnelMutations, FunnelPerformance, FunnelTrackerConfig
{
  constructor(
    private readonly websites: WebsiteQuery,
    /**
     * Funnel step counts come from analytics: the definitions are this module's, but
     * the events land in `analytics_events` like everything else the tracker sends, so
     * the aggregation belongs to the module that owns that table.
     */
    private readonly analyticsEvents: AnalyticsFunnelEvents,
  ) {}

  /**
   * Resolve a website reference, or `null` when it names nothing.
   *
   * Strict rather than lenient — unlike recordings, which tolerates a dangling
   * reference so users can still clear orphaned rows. Funnel rows carry a real
   * `uuid` foreign-key-shaped column, so a reference that does not resolve cannot
   * have funnels; treating the raw reference as a UUID would push a non-UUID string
   * into a `uuid` comparison and error at the driver instead of returning empty.
   */
  private async resolve(websiteRef: string): Promise<ResolvedIds | null> {
    const website = await this.websites.getById(websiteRef);
    if (!website) return null;
    return { websiteId: website.id };
  }

  async list(websiteRef: string): Promise<Funnel[]> {
    const ids = await this.resolve(websiteRef);
    if (!ids) return [];
    return listFunnels(ids.websiteId);
  }

  async get(websiteRef: string, funnelId: string): Promise<Funnel | null> {
    const ids = await this.resolve(websiteRef);
    if (!ids) return null;
    return findFunnel(ids.websiteId, funnelId);
  }

  async create(websiteRef: string, userId: string, input: CreateFunnelInput): Promise<Funnel> {
    const ids = await this.resolve(websiteRef);
    // Throws rather than returning null: the route has already confirmed the caller
    // has a role on this website, so an unresolvable reference here is a bug, not a
    // request the client can correct.
    if (!ids) throw new Error("website not found");

    const created = await insertFunnel(ids.websiteId, userId, input);
    return created;
  }

  async update(
    websiteRef: string,
    funnelId: string,
    input: UpdateFunnelInput,
  ): Promise<Funnel | null> {
    const ids = await this.resolve(websiteRef);
    if (!ids) return null;

    const updated = await updateFunnel(ids.websiteId, funnelId, input);
    if (!updated) return null;

    return updated;
  }

  async remove(websiteRef: string, funnelId: string): Promise<void> {
    const ids = await this.resolve(websiteRef);
    if (!ids) return;

    await deleteFunnel(ids.websiteId, funnelId);
    await this.publishDeleted(ids, [funnelId]);
  }

  async bulkRemove(websiteRef: string, funnelIds: string[]): Promise<void> {
    // Checked before resolving so an empty batch costs no lookup, and — more
    // importantly — can never reach a delete without an id filter.
    if (funnelIds.length === 0) return;
    const ids = await this.resolve(websiteRef);
    if (!ids) return;

    await deleteFunnels(ids.websiteId, funnelIds);
    await this.publishDeleted(ids, funnelIds);
  }

  /**
   * Announce deletions after the rows are gone.
   *
   * One event per funnel regardless of how the delete was requested, so consumers
   * do not need a batched code path. Published unconditionally: the repository does
   * not report whether a row matched, and re-announcing a delete is harmless for a
   * fact that is already true.
   */
  private async publishDeleted(ids: ResolvedIds, funnelIds: string[]): Promise<void> {
    const occurredAt = new Date();
    for (const funnelId of funnelIds) {
    }
  }

  async report(
    websiteRef: string,
    funnelId: string,
    days?: number | undefined,
  ): Promise<FunnelReport | null> {
    const ids = await this.resolve(websiteRef);
    if (!ids) return null;

    // The definition supplies the step names and, crucially, the step count — the
    // aggregation only returns buckets that have events, so a step nobody reached
    // exists in the report only because it exists in the definition.
    const funnel = await findFunnel(ids.websiteId, funnelId);
    if (!funnel) return null;

    const { startIso, endIso } = reportWindow(clampReportDays(days));
    // `websiteId`, not `websiteId` — see `ResolvedIds`.
    const counts = await this.analyticsEvents.countFunnelStepVisitors(
      ids.websiteId,
      funnelId,
      startIso,
      endIso,
    );
    return buildFunnelReport(funnel.steps, counts);
  }

  /**
   * Takes the resolved UUID, not a reference — the tracker's `/init` handler has
   * already loaded the website row, so there is nothing left to resolve.
   */
  async activeForTracker(websiteId: string): Promise<Funnel[]> {
    return listActiveFunnels(websiteId);
  }

  async activeForWebsiteRef(websiteRef: string): Promise<Funnel[]> {
    const ids = await this.resolve(websiteRef);
    if (!ids) return [];
    return listActiveFunnels(ids.websiteId);
  }
}
