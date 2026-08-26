import type { WebsiteQuery } from "../../websites/interfaces";
import type {
  AutomationCrud,
  AutomationDailyRuns,
  AutomationExecutionRow,
  AutomationInsights,
  AutomationListItem,
  AutomationRepository,
  AutomationRow,
  AutomationStats,
  AutomationTrackerSettings,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "../interfaces";

/** How many execution rows the log endpoint returns. */
const EXECUTIONS_LIMIT = 100;

/**
 * Raised when a website reference cannot be resolved on a path that has to write.
 *
 * Carries `status = 403`, not 404, and says "forbidden": the routes answer 403 for
 * an unknown website as well as a forbidden one so the API cannot be used to
 * enumerate site ids, and this error must not undo that by admitting the id was
 * unknown. Reads answer with an empty result instead of throwing — see `resolve`.
 */
export class UnknownWebsiteError extends Error {
  readonly status = 403;
  constructor() {
    super("forbidden");
    this.name = "UnknownWebsiteError";
  }
}

/**
 * The automations read/write facade for the dashboard and the tracker.
 *
 * Its one structural job is to resolve a website reference **exactly once** per
 * call, through the injected `WebsiteQuery` port, and hand the resolved UUID to
 * the repository. Every function it replaced called `resolveWebsiteIds` itself,
 * which meant the automations module read the `websites` table directly — a
 * cross-module table read — and paid for the lookup again on every call, twice in
 * the endpoints that also asserted access.
 *
 * That change is type-invisible: a website reference, a `websiteId` and a website
 * UUID are all `string`, so the compiler cannot catch a caller that hands a
 * repository an unresolved reference. `automations.website_id` is a uuid column
 * and a `websiteId` predicate against it matches zero rows *without erroring* — the
 * failure looks like "this website has no automations". This class being the only
 * caller of the repository is what keeps that honest, which is why the repository
 * is internal to the module and its interface says "resolved UUID" on every
 * parameter.
 */
export class AutomationService
  implements AutomationCrud, AutomationInsights, AutomationTrackerSettings
{
  constructor(
    private readonly repository: AutomationRepository,
    private readonly websites: WebsiteQuery,
  ) {}

  /**
   * Resolve a website reference (UUID or `websiteId`) to the website UUID.
   *
   * `null` when the website is unknown. Routes authorize before calling, and the
   * role check already answers 403 for a website that does not exist, so a `null`
   * here means the website disappeared between the guard and this call. Reads
   * report that as "nothing found" rather than an error; writes raise
   * `UnknownWebsiteError` because there is no id to write against.
   */
  private async resolve(websiteRef: string): Promise<string | null> {
    const website = await this.websites.getById(websiteRef);
    return website?.id ?? null;
  }

  /** As `resolve`, but for the paths that cannot answer with an empty result. */
  private async resolveOrThrow(websiteRef: string): Promise<string> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) throw new UnknownWebsiteError();
    return websiteId;
  }

  // ─── AutomationCrud ──────────────────────────────────────────────────────

  async list(websiteRef: string): Promise<AutomationListItem[]> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return [];
    return this.repository.listWithStats(websiteId);
  }

  async create(
    websiteRef: string,
    userId: string,
    input: CreateAutomationInput,
  ): Promise<AutomationRow> {
    const websiteId = await this.resolveOrThrow(websiteRef);
    return this.repository.create(websiteId, userId, input);
  }

  async get(websiteRef: string, automationId: string): Promise<AutomationRow | null> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return null;
    return this.repository.findById(websiteId, automationId);
  }

  async update(
    websiteRef: string,
    automationId: string,
    patch: UpdateAutomationInput,
  ): Promise<AutomationRow | null> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return null;
    return this.repository.update(websiteId, automationId, patch);
  }

  async remove(websiteRef: string, automationId: string): Promise<void> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return;
    await this.repository.delete(websiteId, automationId);
  }

  /**
   * Delete several automations.
   *
   * Sequential, and deliberately not wrapped in a transaction: each delete spans
   * two statements, and the endpoint answers 204 whether it removed all of them or
   * none. Failing the whole batch because one id was already gone would leave the
   * user unable to clear the rest.
   */
  async bulkDelete(websiteRef: string, automationIds: string[]): Promise<void> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return;
    for (const automationId of automationIds) {
      await this.repository.delete(websiteId, automationId);
    }
  }

  async toggle(websiteRef: string, automationId: string): Promise<AutomationRow | null> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return null;
    return this.repository.toggleActive(websiteId, automationId);
  }

  // ─── AutomationInsights ──────────────────────────────────────────────────

  /**
   * The three insight reads all confirm the automation belongs to this website
   * before touching `automation_events`.
   *
   * That table is keyed by `automation_id` alone, with no website column, so
   * skipping the check would let anyone who can read *any* website's automations
   * read *any* automation's execution log by guessing a UUID.
   */
  async executions(
    websiteRef: string,
    automationId: string,
  ): Promise<AutomationExecutionRow[] | null> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return null;

    const automation = await this.repository.findById(websiteId, automationId);
    if (!automation) return null;

    return this.repository.listExecutions(automationId, EXECUTIONS_LIMIT);
  }

  async stats(websiteRef: string, automationId: string): Promise<AutomationStats | null> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return null;

    const automation = await this.repository.findById(websiteId, automationId);
    if (!automation) return null;

    return this.repository.getStats(automationId);
  }

  async dailyStats(
    websiteRef: string,
    automationId: string,
  ): Promise<AutomationDailyRuns[] | null> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return null;

    const automation = await this.repository.findById(websiteId, automationId);
    if (!automation) return null;

    return this.repository.getDailyRuns(automationId);
  }

  // ─── AutomationTrackerSettings ───────────────────────────────────────────

  async activeFor(websiteRef: string): Promise<AutomationRow[]> {
    const websiteId = await this.resolve(websiteRef);
    if (!websiteId) return [];
    return this.repository.listActive(websiteId);
  }
}
