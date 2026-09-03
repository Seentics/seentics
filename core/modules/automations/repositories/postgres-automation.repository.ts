import { and, asc, desc, eq } from "drizzle-orm";
import { automationEvents, automations, db, sql as pgSql } from "../../../db";
import type {
  AutomationDailyRuns,
  AutomationExecutionRow,
  AutomationListItem,
  AutomationRepository,
  AutomationRow,
  AutomationStats,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "../interfaces";

/**
 * Buckets the daily-runs sparkline draws.
 *
 * A constant here and a literal in the SQL below: `INTERVAL` cannot take a bind
 * parameter, and interpolating one would mean building the interval string by
 * hand inside a query. Keeping the two in step is cheaper than that risk.
 */
const DAILY_RUNS_DAYS = 14;

/**
 * Counters in the shape the dashboard reads.
 *
 * `successRate` is over *action* rows, not runs: a run with no actions has
 * nothing that could have failed, so counting it in the denominator would make
 * every trigger-only automation look like a 0% success. When there are runs but
 * no action rows at all the rate is reported as 100 rather than 0 — the same
 * reasoning, and the figure the UI has always shown.
 */
function summarize(total: number, success: number, failure: number, last30: number): AutomationStats {
  const actionTotal = success + failure;
  return {
    totalExecutions: total,
    successCount: success,
    failureCount: failure,
    successRate:
      actionTotal > 0 ? Math.round((success / actionTotal) * 1000) / 10 : total > 0 ? 100 : 0,
    last30Days: last30,
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Active automations for one website.
 *
 * Exported as a function, not only as a repository method, because
 * `routes/tracker.ts` is still a module-level singleton router wired directly in
 * `index.ts` — it has nothing to inject a repository instance through. It already
 * holds the resolved website UUID from validating the request origin, so calling
 * this directly costs one query instead of resolving the reference again.
 *
 * @param websiteId resolved `websites.id` UUID — a `websiteId` here matches nothing.
 */
async function listActiveAutomations(websiteId: string): Promise<AutomationRow[]> {
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.websiteId, websiteId), eq(automations.isActive, true)));
}

/**
 * Active automations in evaluation order.
 *
 * Same exception as `listActiveAutomations`: the evaluation service is reachable
 * from the un-injected tracker route, so this stays a function.
 */
export async function listActiveAutomationsByPriority(
  websiteId: string,
): Promise<AutomationRow[]> {
  return db
    .select()
    .from(automations)
    .where(and(eq(automations.websiteId, websiteId), eq(automations.isActive, true)))
    .orderBy(asc(automations.priority));
}

/**
 * Drizzle/Postgres implementation of `AutomationRepository`.
 *
 * Stateless, so one instance per process is enough. Every method takes a resolved
 * website UUID; see the interface on why that is not negotiable.
 */
export class PostgresAutomationRepository implements AutomationRepository {
  /**
   * One query for the whole list, counters included.
   *
   * `FILTER (WHERE …)` over a single LEFT JOIN rather than a lateral subquery per
   * counter: this is the automations landing page, and four correlated
   * subqueries per row is the difference between one index scan and N.
   */
  async listWithStats(websiteId: string): Promise<AutomationListItem[]> {
    const rows = await pgSql<
      {
        id: string;
        website_id: string;
        name: string;
        definition: Record<string, unknown>;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
        total: number;
        success_count: number;
        failure_count: number;
        last30: number;
      }[]
    >`
    SELECT
      a.id, a.website_id, a.name, a.definition, a.is_active,
      a.created_at, a.updated_at,
      COUNT(e.id) FILTER (WHERE e.record_type = 'server_run')::int              AS total,
      COUNT(e.id) FILTER (WHERE e.record_type = 'action' AND e.status = 'success')::int  AS success_count,
      COUNT(e.id) FILTER (WHERE e.record_type = 'action' AND e.status = 'failed')::int   AS failure_count,
      COUNT(e.id) FILTER (WHERE e.record_type = 'server_run' AND e.created_at >= NOW() - INTERVAL '30 days')::int AS last30
    FROM automations a
    LEFT JOIN automation_events e ON e.automation_id = a.id
    WHERE a.website_id = ${websiteId}
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `;

    return rows.map((a) => ({
      id: a.id,
      website_id: a.website_id,
      name: a.name,
      definition: a.definition,
      is_active: a.is_active,
      created_at: toIsoString(a.created_at),
      updated_at: toIsoString(a.updated_at),
      stats: summarize(
        Number(a.total ?? 0),
        Number(a.success_count ?? 0),
        Number(a.failure_count ?? 0),
        Number(a.last30 ?? 0),
      ),
    }));
  }

  async listActive(websiteId: string): Promise<AutomationRow[]> {
    return listActiveAutomations(websiteId);
  }

  async listActiveByPriority(websiteId: string): Promise<AutomationRow[]> {
    return listActiveAutomationsByPriority(websiteId);
  }

  async findById(websiteId: string, automationId: string): Promise<AutomationRow | null> {
    const [row] = await db
      .select()
      .from(automations)
      .where(and(eq(automations.id, automationId), eq(automations.websiteId, websiteId)))
      .limit(1);
    return row ?? null;
  }

  async create(
    websiteId: string,
    userId: string,
    input: CreateAutomationInput,
  ): Promise<AutomationRow> {
    const [row] = await db
      .insert(automations)
      .values({
        websiteId,
        userId,
        name: input.name,
        definition: input.definition,
        isActive: input.is_active ?? true,
      })
      .returning();
    return row as AutomationRow;
  }

  async update(
    websiteId: string,
    automationId: string,
    patch: UpdateAutomationInput,
  ): Promise<AutomationRow | null> {
    const [row] = await db
      .update(automations)
      .set({
        // Spread-if-present rather than assigning `patch.name` directly: an
        // absent field must leave the column alone, and `undefined` in a Drizzle
        // `set` is a no-op only by accident of the driver.
        ...(patch.name != null ? { name: patch.name } : {}),
        ...(patch.definition != null ? { definition: patch.definition } : {}),
        ...(patch.is_active != null ? { isActive: patch.is_active } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(automations.id, automationId), eq(automations.websiteId, websiteId)))
      .returning();
    return row ?? null;
  }

  async toggleActive(websiteId: string, automationId: string): Promise<AutomationRow | null> {
    const current = await this.findById(websiteId, automationId);
    if (!current) return null;

    const [row] = await db
      .update(automations)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(and(eq(automations.id, automationId), eq(automations.websiteId, websiteId)))
      .returning();
    return row ?? null;
  }

  async delete(websiteId: string, automationId: string): Promise<void> {
    await db.delete(automationEvents).where(eq(automationEvents.automationId, automationId));
    await db
      .delete(automations)
      .where(and(eq(automations.id, automationId), eq(automations.websiteId, websiteId)));
  }

  async listExecutions(automationId: string, limit: number): Promise<AutomationExecutionRow[]> {
    return db
      .select()
      .from(automationEvents)
      .where(eq(automationEvents.automationId, automationId))
      .orderBy(desc(automationEvents.createdAt))
      .limit(limit);
  }

  async getStats(automationId: string): Promise<AutomationStats> {
    const [totals] = await pgSql<{ total: number; success: number; failure: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE record_type = 'server_run')::int                             AS total,
      COUNT(*) FILTER (WHERE record_type = 'action' AND status = 'success')::int          AS success,
      COUNT(*) FILTER (WHERE record_type = 'action' AND status = 'failed')::int           AS failure
    FROM automation_events
    WHERE automation_id = ${automationId}
  `;
    const [last30] = await pgSql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt
    FROM automation_events
    WHERE automation_id = ${automationId}
      AND record_type = 'server_run'
      AND created_at >= NOW() - INTERVAL '30 days'
  `;

    return summarize(
      totals?.total ?? 0,
      totals?.success ?? 0,
      totals?.failure ?? 0,
      last30?.cnt ?? 0,
    );
  }

  /**
   * Runs per day over the last `DAILY_RUNS_DAYS` days, padded to a full window.
   *
   * Postgres returns only days that have rows, but the sparkline needs a fixed
   * number of buckets — a gap would silently shorten the chart rather than show a
   * zero. Padding happens here so every caller gets the same length.
   */
  async getDailyRuns(automationId: string): Promise<AutomationDailyRuns[]> {
    const rows = await pgSql<{ day: string; runs: number }[]>`
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS runs
    FROM automation_events
    WHERE automation_id = ${automationId}
      AND created_at >= NOW() - INTERVAL '14 days'
    GROUP BY 1
    ORDER BY 1
  `;

    const byDay = new Map(rows.map((r) => [r.day, Number(r.runs)]));
    return Array.from({ length: DAILY_RUNS_DAYS }, (_, i) => {
      const d = new Date(Date.now() - (DAILY_RUNS_DAYS - 1 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return { day: `D${i + 1}`, runs: byDay.get(key) ?? 0 };
    });
  }
}
