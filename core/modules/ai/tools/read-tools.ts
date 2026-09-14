import { z } from "zod";
import { asLinks, asTable, type DisplayBlock } from "./display";
import type { AiTool, ToolContext, ToolResult } from "./tool.types";

/**
 * Read surfaces the agent can call, injected as ports.
 *
 * Functions rather than module objects so the AI module depends on the shape it needs
 * rather than on five peers' interfaces, and so each can be stubbed in a test without
 * standing up the module behind it.
 *
 * Every one takes a resolved `websiteId` as its first argument, supplied by the tool from
 * `ToolContext`. None of them is reachable with an id the model chose.
 */
export type ReadPorts = {
  trafficSummary(websiteId: string, days: number): Promise<unknown>;
  topPages(websiteId: string, days: number): Promise<unknown>;
  topSources(websiteId: string, days: number): Promise<unknown>;
  dimensions(websiteId: string, days: number): Promise<unknown>;
  funnels(websiteId: string): Promise<unknown>;
  funnelPerformance(websiteId: string, funnelId: string, days: number): Promise<unknown>;
  automations(websiteId: string): Promise<unknown>;
  heatmapPages(websiteId: string): Promise<unknown>;
  recentSessions(websiteId: string, limit: number): Promise<unknown>;
  errorGroups(websiteId: string, days: number): Promise<unknown>;
  revenue(websiteId: string, days: number): Promise<unknown>;
};

/**
 * The look-back window, shared by every tool that takes one.
 *
 * Bounded rather than free: a year is the most any of these reads is useful over, and an
 * unbounded number reaches the repositories as a scan nobody asked for.
 */
const days = z
  .number()
  .int()
  .min(1)
  .max(365)
  .default(7)
  .describe("Look-back window in days (1-365)");

/**
 * Wraps a port call so a thrown repository error becomes a message the model can relay,
 * and attaches how the result should be drawn.
 *
 * `display` is chosen here, by the tool that knows its own data shape — never by the
 * model. See `display.ts` for why that matters.
 */
function read(
  fn: () => Promise<unknown>,
  display?: (data: unknown) => DisplayBlock | undefined,
): Promise<ToolResult> {
  return fn().then(
    (data) => ({ ok: true as const, data: { data, display: display?.(data) } }),
    (err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message.slice(0, 200) : "Read failed",
    }),
  );
}

/** Most reads return either an array or `{ something: [...] }`; find the rows either way. */
function rowsOf(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const first = Object.values((data ?? {}) as Record<string, unknown>).find(Array.isArray);
  return (first as Array<Record<string, unknown>>) ?? [];
}

const tableOf = (data: unknown) => {
  const rows = rowsOf(data);
  return rows.length ? asTable(rows) : undefined;
};

export function readTools(ports: ReadPorts): AiTool<any>[] {
  /*
   * Inferred from the schema rather than declared, so a field with `.default()` is
   * required in the handler and optional to the model — which is the whole point of
   * giving it a default.
   */
  const tool = <S extends z.ZodTypeAny>(
    name: string,
    description: string,
    schema: S,
    handler: (args: z.output<S>, ctx: ToolContext) => Promise<ToolResult>,
  ): AiTool<z.output<S>> => ({ name, kind: "read", description, schema, handler });

  return [
    tool(
      "get_traffic_summary",
      "Visitors, pageviews, sessions, bounce rate and session duration for a period, " +
      "with the change against the previous period. Start here for 'how is traffic doing'.",
      z.object({ days }),
      (a, ctx) => read(() => ports.trafficSummary(ctx.websiteId, a.days)),
    ),

    tool(
      "get_top_pages",
      "Most-visited pages with views, unique visitors, average time and bounce rate.",
      z.object({ days }),
      (a, ctx) => read(() => ports.topPages(ctx.websiteId, a.days), tableOf),
    ),

    tool(
      "get_top_sources",
      "Where visitors came from — referrers and channels, with visitors per source.",
      z.object({ days }),
      (a, ctx) => read(() => ports.topSources(ctx.websiteId, a.days), tableOf),
    ),

    tool(
      "get_audience_breakdown",
      "Countries, devices, browsers and operating systems in one call. Use for any " +
      "'who are my visitors' question rather than four separate lookups.",
      z.object({ days }),
      (a, ctx) => read(() => ports.dimensions(ctx.websiteId, a.days)),
    ),

    tool(
      "list_funnels",
      "The funnels configured for this website, with their steps. Call this first when " +
      "the user names a funnel, to find its id.",
      z.object({}),
      (_a, ctx) => read(() => ports.funnels(ctx.websiteId), tableOf),
    ),

    tool(
      "get_funnel_performance",
      "Step-by-step conversion and drop-off for one funnel. Needs a funnel id from list_funnels.",
      z.object({ funnelId: z.string().min(1).describe("Funnel id from list_funnels"), days }),
      (a, ctx) => read(() => ports.funnelPerformance(ctx.websiteId, a.funnelId, a.days)),
    ),

    tool(
      "list_automations",
      "Automations on this website with their triggers, actions and status.",
      z.object({}),
      (_a, ctx) => read(() => ports.automations(ctx.websiteId), tableOf),
    ),

    tool(
      "list_heatmap_pages",
      "Pages with heatmap data, and how many interactions each has recorded.",
      z.object({}),
      (_a, ctx) => read(() => ports.heatmapPages(ctx.websiteId), tableOf),
    ),

    tool(
      "list_recent_sessions",
      "Recent session recordings with duration, pages viewed, device and whether the " +
      "visitor hit errors or rage-clicked.",
      z.object({
        limit: z.number().int().min(1).max(50).default(10)
          .describe("How many sessions to return (1-50)"),
      }),
      (a, ctx) => read(() => ports.recentSessions(ctx.websiteId, a.limit), (d) => {
        const rows = rowsOf(d);
        return rows.length
          ? asLinks(rows.map((r) => ({
              label: String(r.session_id ?? "session"),
              sublabel: [r.device_type, r.browser, r.country].filter(Boolean).join(" · "),
              href: `/websites/${ctx.websiteId}/replays/${String(r.session_id ?? "")}`,
            })))
          : undefined;
      }),
    ),

    tool(
      "list_error_groups",
      "Frontend JavaScript errors grouped by fault, with how often each occurred and " +
      "where. Use for 'what is broken' questions.",
      z.object({ days }),
      (a, ctx) => read(() => ports.errorGroups(ctx.websiteId, a.days), tableOf),
    ),

    tool(
      "get_revenue_summary",
      "Revenue, orders and attribution for a period, when purchase tracking is set up.",
      z.object({ days }),
      (a, ctx) => read(() => ports.revenue(ctx.websiteId, a.days)),
    ),
  ];
}
