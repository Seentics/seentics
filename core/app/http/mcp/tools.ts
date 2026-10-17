/**
 * The MCP server's tools: what an outside assistant (Claude, Cursor, ChatGPT…) may ask of an
 * account's Seentics data with one account API key.
 *
 * Two groups:
 *
 * - Four of this surface's own, for the questions a dashboard cannot answer in one screen:
 *   the account's websites, every site against its previous period (the agency question —
 *   "which client dropped?"), and what moved on one site, overall or for one segment.
 * - The dashboard assistant's read tools (`AiModule.readTools`), each with a `website_id`
 *   added. The assistant binds its website from the page it was opened on; here the caller
 *   names one, and every call is checked against the key owner's websites before it runs.
 *
 * All of it reads. Nothing here creates, changes or deletes, and the data returned includes
 * strings visitors wrote (paths, titles, event names, error messages) — the server's
 * instructions say so, because an outside model is reading them.
 */

import { z } from "zod";
import { MemoryCache } from "../../../platform/cache/memory-cache";
import { maskPath } from "../../../platform/heuristics";
import type { AccountScope } from "../../../modules/api-keys/interfaces";
import type { AssistantReadTools } from "../../../modules/ai/interfaces";
import type { MetricTotals, MetricWindow, OverviewMetric, SiteMetricSource } from "../../../modules/agency/interfaces";
import type {
  AnalyticsAnomalyReads,
  AnalyticsImpactReads,
  AnalyticsInsightReads,
  AnalyticsReads,
  InsightSnapshotData,
} from "../../../modules/analytics/interfaces";
import type { ClientDirectory, ClientWithWebsites, OwnedWebsites, Website } from "../../../modules/websites/interfaces";
import type { McpTool, McpToolOutcome } from "./protocol";

/** Who is asking: the account key's owner and what the key may read. */
export type McpCaller = { userId: string; apiKeyId: string; scopes: readonly AccountScope[] };

/** A tool and the key scope it needs. */
export type ScopedMcpTool = McpTool<McpCaller> & { scope: AccountScope };

export type McpToolDeps = {
  websites: Pick<OwnedWebsites, "allWebsites">;
  clients: Pick<ClientDirectory, "listClients">;
  analytics: Pick<AnalyticsReads, "getGoals">;
  insights: AnalyticsInsightReads;
  impact: AnalyticsImpactReads;
  goals: Pick<AnalyticsAnomalyReads, "goalCompletionsByDay">;
  /** The agency overview's per-site sources, so these figures and the overview's agree. */
  metrics: readonly SiteMetricSource[];
  assistant: AssistantReadTools;
  now?: () => number;
};

const DAY_MS = 86_400_000;
/** Most sites `compare_websites` reads in one call; an account past it is told so. */
const MAX_COMPARED_SITES = 200;
/** Per-site reads in flight at once, so a large agency is not 200 queries in one burst. */
const SITE_CONCURRENCY = 8;
const CACHE_TTL_MS = 5 * 60_000;
const CLIENT_PAGE = 100;

/** Assistant tools that read replays or heatmaps need that scope; every other read is analytics. */
const ASSISTANT_TOOL_SCOPES: Record<string, AccountScope> = {
  list_recent_sessions: "replays:read",
  list_frustrated_sessions: "replays:read",
  get_session_summary: "replays:read",
  list_heatmap_pages: "heatmaps:read",
  get_heatmap_insights: "heatmaps:read",
};

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

const WEBSITE_ID = {
  type: "string",
  description: "The website's id, from list_websites",
} as const;

/** The last `days` complete UTC days, and the same number of days before them. */
export function completeDayWindows(days: number, now: number): { current: MetricWindow; previous: MetricWindow; end: Date } {
  const today = Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z");
  const day = (offset: number) => new Date(today + offset * DAY_MS).toISOString().slice(0, 10);
  return {
    current: { from: day(-days), to: day(-1) },
    previous: { from: day(-2 * days), to: day(-days - 1) },
    end: new Date(today),
  };
}

/** Change as a percentage, one decimal; `null` when there was nothing before to compare with. */
export function changePct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

const pair = (cur: number, prev: number) => ({ current: cur, previous: prev, change_pct: changePct(cur, prev) });
const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/** Run `fn` over `items`, `limit` at a time, keeping order. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function invalid(error: z.ZodError): McpToolOutcome {
  const detail = error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  return { ok: false, error: `Invalid arguments: ${detail}` };
}

const daysArg = (fallback: number, max: number) => z.number().int().min(1).max(max).default(fallback);

const COMPARED_METRICS = ["visitors", "pageviews", "goal_completions", "revenue", "leads", "ad_conversions", "recordings"] as const;
type ComparedMetric = (typeof COMPARED_METRICS)[number];

/** The overview sources' names, as this surface words them: `conversions` there are ad-platform ones. */
const FROM_SOURCE: Partial<Record<OverviewMetric, ComparedMetric>> = {
  visitors: "visitors",
  pageviews: "pageviews",
  revenue: "revenue",
  leads: "leads",
  conversions: "ad_conversions",
  recordings: "recordings",
};

export function createMcpTools(deps: McpToolDeps): ScopedMcpTool[] {
  const now = () => deps.now?.() ?? Date.now();
  const cache = new MemoryCache<unknown>(2_000);

  const cached = async <T>(key: string, compute: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key) as T | undefined;
    if (hit !== undefined) return hit;
    const value = await compute();
    cache.set(key, value, CACHE_TTL_MS);
    return value;
  };

  /** Every client of the owner, a page at a time; an account with none has an empty list. */
  async function allClients(ownerId: string): Promise<ClientWithWebsites[]> {
    const out: ClientWithWebsites[] = [];
    let after: { createdAt: Date; id: string } | undefined;
    for (;;) {
      const page = await deps.clients.listClients(ownerId, {}, { limit: CLIENT_PAGE, after });
      out.push(...page.items);
      const last = page.items[page.items.length - 1];
      if (!page.hasMore || !last) return out;
      after = { createdAt: last.createdAt, id: last.id };
    }
  }

  async function sitesWithClients(ownerId: string): Promise<{ sites: Website[]; clientName: Map<string, string> }> {
    const [sites, clients] = await Promise.all([deps.websites.allWebsites(ownerId), allClients(ownerId)]);
    return { sites, clientName: new Map(clients.map((c) => [c.id, c.name])) };
  }

  /** Narrow to one client by id or (case-insensitive) name; `null` when nothing matches. */
  function forClient(sites: Website[], clientName: Map<string, string>, client: string | undefined): Website[] | null {
    if (!client) return sites;
    const wanted = client.trim().toLowerCase();
    const ids = [...clientName].filter(([id, name]) => id === client || name.toLowerCase() === wanted).map(([id]) => id);
    if (ids.length === 0) return null;
    return sites.filter((s) => s.clientId !== null && ids.includes(s.clientId));
  }

  /** The owner's website, or a refusal that names the way to find a valid one. */
  async function ownedSite(caller: McpCaller, websiteId: unknown): Promise<Website | McpToolOutcome> {
    if (typeof websiteId !== "string" || !websiteId.trim()) {
      return { ok: false, error: "website_id is required. Call list_websites to find it." };
    }
    const sites = await deps.websites.allWebsites(caller.userId);
    const site = sites.find((s) => s.id === websiteId.trim());
    return site ?? { ok: false, error: `No website ${websiteId} on this account. Call list_websites for the ids.` };
  }

  const isSite = (v: Website | McpToolOutcome): v is Website => "id" in v;

  /** Each compared metric per site, over one window. A source that fails leaves its metrics out. */
  async function windowTotals(ids: string[], window: MetricWindow): Promise<{ bySite: Map<string, Partial<Record<ComparedMetric, number>>>; counted: Set<ComparedMetric> }> {
    const bySite = new Map<string, Partial<Record<ComparedMetric, number>>>();
    const counted = new Set<ComparedMetric>();
    const at = (id: string) => bySite.get(id) ?? bySite.set(id, {}).get(id)!;
    const results = await Promise.allSettled(deps.metrics.map((s) => s.totalsBySite(ids, window)));
    results.forEach((r, i) => {
      if (r.status === "rejected") return;
      for (const m of deps.metrics[i]!.metrics) {
        const name = FROM_SOURCE[m];
        if (name) counted.add(name);
      }
      for (const [siteId, totals] of r.value as Map<string, MetricTotals>) {
        for (const [m, v] of Object.entries(totals) as [OverviewMetric, number][]) {
          const name = FROM_SOURCE[m];
          if (name) at(siteId)[name] = v;
        }
      }
    });
    return { bySite, counted };
  }

  /** Goal completions per site over both windows, from each site's daily goal counts. */
  async function goalTotals(ids: string[], windows: { current: MetricWindow; previous: MetricWindow }): Promise<Map<string, { current: number; previous: number }> | null> {
    const days: string[] = [];
    for (let t = Date.parse(windows.previous.from + "T00:00:00Z"); t <= Date.parse(windows.current.to + "T00:00:00Z"); t += DAY_MS) {
      days.push(new Date(t).toISOString().slice(0, 10));
    }
    const split = days.indexOf(windows.current.from);
    try {
      const rows = await mapLimit(ids, SITE_CONCURRENCY, async (id) => {
        const goals = await deps.goals.goalCompletionsByDay(id, days);
        let current = 0;
        let previous = 0;
        for (const g of goals) g.counts.forEach((n, i) => { if (i >= split) current += n; else previous += n; });
        return [id, { current, previous }] as const;
      });
      return new Map(rows);
    } catch {
      return null;
    }
  }

  const listWebsites: McpTool<McpCaller> = {
    name: "list_websites",
    title: "List websites",
    description:
      "Every website on this Seentics account, with its id, domain and (for agencies) the client it belongs to. " +
      "Call this first: every other tool takes a website_id from here.",
    inputSchema: {
      type: "object",
      properties: { client: { type: "string", description: "Only this client's websites (client name or id)" } },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async call(args, caller) {
      const parsed = z.object({ client: z.string().max(200).optional() }).safeParse(args);
      if (!parsed.success) return invalid(parsed.error);
      const { sites, clientName } = await sitesWithClients(caller.userId);
      const chosen = forClient(sites, clientName, parsed.data.client);
      if (!chosen) return { ok: false, error: `No client named ${parsed.data.client}. Call list_websites without a client to see them.` };
      return {
        ok: true,
        data: {
          websites: chosen.map((s) => ({
            website_id: s.id,
            name: s.name,
            domain: s.url,
            client: s.clientId ? clientName.get(s.clientId) ?? null : null,
            tracking_verified: s.isVerified,
            active: s.isActive,
          })),
        },
      };
    },
  };

  const compareWebsites: McpTool<McpCaller> = {
    name: "compare_websites",
    title: "Compare websites and clients",
    description:
      "Every website (or one client's) over the last N complete days against the N days before: visitors, " +
      "pageviews, goal completions (conversions), revenue, leads, ad-platform conversions and recordings, with " +
      "% change, plus totals per client. Sorted by the biggest drop in `sort_by` first. Use for 'which client or " +
      "site dropped this week?' and other questions across many sites.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Window length in complete UTC days (1-90), compared with the same length before it. Default 7" },
        client: { type: "string", description: "Only this client's websites (client name or id)" },
        sort_by: { type: "string", enum: [...COMPARED_METRICS], description: "Metric to rank by, biggest drop first. Default visitors" },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async call(args, caller) {
      const parsed = z.object({
        days: daysArg(7, 90),
        client: z.string().max(200).optional(),
        sort_by: z.enum(COMPARED_METRICS).default("visitors"),
      }).safeParse(args);
      if (!parsed.success) return invalid(parsed.error);
      const { days, client, sort_by } = parsed.data;
      const { sites: all, clientName } = await sitesWithClients(caller.userId);
      const chosen = forClient(all, clientName, client);
      if (!chosen) return { ok: false, error: `No client named ${client}. Call list_websites to see the clients.` };
      const sites = chosen.slice(0, MAX_COMPARED_SITES);
      const windows = completeDayWindows(days, now());

      const ids = sites.map((s) => s.id);
      const computed = await cached(`cmp:${caller.userId}:${days}:${ids.join(",")}:${windows.current.to}`, async () => {
        const [cur, prev, goals] = await Promise.all([
          windowTotals(ids, windows.current),
          windowTotals(ids, windows.previous),
          goalTotals(ids, windows),
        ]);
        return { cur, prev, goals };
      });
      const metrics = COMPARED_METRICS.filter((m) =>
        m === "goal_completions" ? computed.goals !== null : computed.cur.counted.has(m) && computed.prev.counted.has(m));

      const figures = (siteIds: string[]) => {
        const out: Record<string, ReturnType<typeof pair>> = {};
        for (const m of metrics) {
          let c = 0;
          let p = 0;
          for (const id of siteIds) {
            if (m === "goal_completions") {
              c += computed.goals?.get(id)?.current ?? 0;
              p += computed.goals?.get(id)?.previous ?? 0;
            } else {
              c += computed.cur.bySite.get(id)?.[m] ?? 0;
              p += computed.prev.bySite.get(id)?.[m] ?? 0;
            }
          }
          out[m] = pair(Math.round(c * 100) / 100, Math.round(p * 100) / 100);
        }
        return out;
      };
      const drop = (row: { metrics: Record<string, ReturnType<typeof pair>> }) => {
        const v = row.metrics[sort_by];
        return v ? v.current - v.previous : 0;
      };

      const siteRows = sites
        .map((s) => ({
          website_id: s.id,
          name: s.name,
          domain: s.url,
          client: s.clientId ? clientName.get(s.clientId) ?? null : null,
          metrics: figures([s.id]),
        }))
        .sort((a, b) => drop(a) - drop(b));

      const byClient = new Map<string | null, string[]>();
      for (const s of sites) byClient.set(s.clientId, [...(byClient.get(s.clientId) ?? []), s.id]);
      const clientRows = clientName.size === 0 ? undefined : [...byClient]
        .map(([id, siteIds]) => ({ client: id ? clientName.get(id) ?? id : "Unassigned", websites: siteIds.length, metrics: figures(siteIds) }))
        .sort((a, b) => drop(a) - drop(b));

      return {
        ok: true,
        data: {
          window: windows.current,
          previous_window: windows.previous,
          sorted_by: sort_by,
          ...(metrics.includes(sort_by) ? {} : { note: `${sort_by} is not available for this account, so the order is arbitrary.` }),
          totals: figures(ids),
          ...(clientRows ? { clients: clientRows } : {}),
          websites: siteRows,
          ...(chosen.length > sites.length ? { truncated: `Only the first ${MAX_COMPARED_SITES} of ${chosen.length} websites were compared. Narrow with client.` } : {}),
        },
      };
    },
  };

  const explainChange: McpTool<McpCaller> = {
    name: "explain_change",
    title: "Explain what changed",
    description:
      "What moved on one website over the last N complete days against the N days before, broken down the way " +
      "you would look for a cause: overall traffic, each device (sessions, bounce rate, conversions), each " +
      "channel, the pages that gained or lost the most views, and the main conversion event. Use for 'why did " +
      "traffic / conversions drop?' and 'what is happening on mobile?'.",
    inputSchema: {
      type: "object",
      properties: {
        website_id: WEBSITE_ID,
        days: { type: "number", description: "Window length in complete UTC days (1-30), compared with the same length before it. Default 7" },
      },
      required: ["website_id"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async call(args, caller) {
      const site = await ownedSite(caller, args.website_id);
      if (!isSite(site)) return site;
      const parsed = z.object({ website_id: z.string(), days: daysArg(7, 30) }).safeParse(args);
      if (!parsed.success) return invalid(parsed.error);
      const { days } = parsed.data;
      const windows = completeDayWindows(days, now());
      const snap = await cached(`snap:${site.id}:${days}:${windows.current.to}`, () => deps.insights.getInsightSnapshot(site.id, days, windows.end));
      return { ok: true, data: { website: site.name, window: windows.current, previous_window: windows.previous, ...presentSnapshot(snap) } };
    },
  };

  const compareSegment: McpTool<McpCaller> = {
    name: "compare_segment",
    title: "Compare a segment",
    description:
      "Sessions, bounce rate, conversions and conversion rate for one slice of a website's visitors — a device, " +
      "a channel, an entry page, or any mix — over the last N complete days against the N days before. Use for " +
      "'is mobile checkout losing visitors?' (device mobile, page /checkout) or 'how is paid traffic converting?'.",
    inputSchema: {
      type: "object",
      properties: {
        website_id: WEBSITE_ID,
        days: { type: "number", description: "Window length in complete UTC days (1-90). Default 7" },
        device: { type: "string", description: "desktop, mobile or tablet" },
        channel: { type: "string", enum: ["direct", "organic", "paid", "social", "email", "referral", "campaign", "internal"] },
        page: { type: "string", description: "Sessions that entered on this path, e.g. /checkout; :param segments match any one segment" },
        event: { type: "string", description: "The conversion event to count. Default: the site's most frequent purchase / signup event" },
      },
      required: ["website_id"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async call(args, caller) {
      const site = await ownedSite(caller, args.website_id);
      if (!isSite(site)) return site;
      const parsed = z.object({
        website_id: z.string(),
        days: daysArg(7, 90),
        device: z.string().trim().toLowerCase().max(40).optional(),
        channel: z.enum(["direct", "organic", "paid", "social", "email", "referral", "campaign", "internal"]).optional(),
        page: z.string().trim().max(500).optional(),
        event: z.string().trim().max(200).optional(),
      }).safeParse(args);
      if (!parsed.success) return invalid(parsed.error);
      const { days, device, channel, page, event } = parsed.data;
      const windows = completeDayWindows(days, now());
      const at = (w: MetricWindow) => ({ from: new Date(w.from + "T00:00:00Z"), to: new Date(Date.parse(w.to + "T00:00:00Z") + DAY_MS) });
      const segment = { page: page || null, channel: channel ?? null, device: device || null };
      const cur = await deps.impact.getImpactCounts(site.id, { ...at(windows.current), ...segment, event: event || undefined });
      // The previous window counts the same event the current one settled on, so the two compare.
      const prev = await deps.impact.getImpactCounts(site.id, { ...at(windows.previous), ...segment, event: cur.event });
      return {
        ok: true,
        data: {
          website: site.name,
          segment: { device: segment.device, channel: segment.channel, entry_page: segment.page },
          window: windows.current,
          previous_window: windows.previous,
          conversion_event: cur.event,
          sessions: pair(cur.sessions, prev.sessions),
          bounce_rate_pct: pair(rate(cur.bounces, cur.sessions), rate(prev.bounces, prev.sessions)),
          conversions: pair(cur.conversions, prev.conversions),
          conversion_rate_pct: pair(rate(cur.conversions, cur.sessions), rate(prev.conversions, prev.sessions)),
        },
      };
    },
  };

  const goalStats: McpTool<McpCaller> = {
    name: "get_goal_stats",
    title: "Goal conversions",
    description: "Each goal on a website with its completions and conversion rate over the period, as the Goals page shows them.",
    inputSchema: {
      type: "object",
      properties: { website_id: WEBSITE_ID, days: { type: "number", description: "Look-back window in days (1-365). Default 30" } },
      required: ["website_id"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async call(args, caller) {
      const site = await ownedSite(caller, args.website_id);
      if (!isSite(site)) return site;
      const parsed = z.object({ website_id: z.string(), days: daysArg(30, 365) }).safeParse(args);
      if (!parsed.success) return invalid(parsed.error);
      return { ok: true, data: await deps.analytics.getGoals(site.id, { days: String(parsed.data.days) }) };
    },
  };

  const own = [listWebsites, compareWebsites, explainChange, compareSegment, goalStats];
  const ownNames = new Set(own.map((t) => t.name));

  const assistant: ScopedMcpTool[] = deps.assistant.list()
    .filter((t) => !ownNames.has(t.name))
    .map((t) => {
      const props = (t.parameters.properties ?? {}) as Record<string, unknown>;
      const required = Array.isArray(t.parameters.required) ? (t.parameters.required as string[]) : [];
      return {
        name: t.name,
        title: t.name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
        description: t.description,
        scope: ASSISTANT_TOOL_SCOPES[t.name] ?? "analytics:read",
        inputSchema: { ...t.parameters, type: "object", properties: { website_id: WEBSITE_ID, ...props }, required: ["website_id", ...required] },
        annotations: READ_ONLY,
        async call(args: Record<string, unknown>, caller: McpCaller): Promise<McpToolOutcome> {
          const site = await ownedSite(caller, args.website_id);
          if (!isSite(site)) return site;
          const { website_id: _, ...rest } = args;
          return deps.assistant.run(t.name, rest, { websiteId: site.id, userId: caller.userId });
        },
      };
    });

  return [...own.map((t) => ({ ...t, scope: "analytics:read" as const })), ...assistant];
}

/** The tools this caller's key may use. */
export function toolsFor(tools: readonly ScopedMcpTool[], caller: McpCaller): ScopedMcpTool[] {
  return tools.filter((t) => caller.scopes.includes(t.scope));
}

/** The insight snapshot as change, worst first; paths masked as the insight's own are. */
export function presentSnapshot(s: InsightSnapshotData) {
  const t = s.traffic;
  const devices = s.devices
    .map((d) => ({
      device: d.name,
      sessions: pair(d.sessions.cur, d.sessions.prev),
      bounce_rate_pct: pair(rate(d.bounces.cur, d.sessions.cur), rate(d.bounces.prev, d.sessions.prev)),
      conversions: pair(d.conversions.cur, d.conversions.prev),
      conversion_rate_pct: pair(rate(d.conversions.cur, d.sessions.cur), rate(d.conversions.prev, d.sessions.prev)),
    }))
    .sort((a, b) => (a.sessions.current - a.sessions.previous) - (b.sessions.current - b.sessions.previous));
  const channels = s.channels
    .map((c) => ({
      channel: c.name,
      visitors: pair(c.visitors.cur, c.visitors.prev),
      sessions: pair(c.sessions.cur, c.sessions.prev),
      bounce_rate_pct: pair(rate(c.bounces.cur, c.sessions.cur), rate(c.bounces.prev, c.sessions.prev)),
    }))
    .sort((a, b) => (a.visitors.current - a.visitors.previous) - (b.visitors.current - b.visitors.previous));
  const pages = s.pages
    .map((p) => ({ page: maskPath(p.path), views: pair(p.views.cur, p.views.prev) }))
    .filter((p) => p.views.current !== p.views.previous)
    .sort((a, b) => Math.abs(b.views.current - b.views.previous) - Math.abs(a.views.current - a.views.previous))
    .slice(0, 10);
  return {
    traffic: {
      visitors: pair(t.visitors.cur, t.visitors.prev),
      pageviews: pair(t.pageviews.cur, t.pageviews.prev),
      sessions: pair(t.sessions.cur, t.sessions.prev),
      bounce_rate_pct: pair(rate(t.bounces.cur, t.sessions.cur), rate(t.bounces.prev, t.sessions.prev)),
      avg_session_seconds: pair(
        t.sessions.cur > 0 ? Math.round(t.durationSec.cur / t.sessions.cur) : 0,
        t.sessions.prev > 0 ? Math.round(t.durationSec.prev / t.sessions.prev) : 0,
      ),
    },
    conversion: s.conversion ? { event: s.conversion.event, count: pair(s.conversion.count.cur, s.conversion.count.prev) } : null,
    devices,
    channels,
    pages_moved_most: pages,
  };
}
