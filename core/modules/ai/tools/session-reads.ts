import { z } from "zod";
import {
  FRUSTRATION_SIGNAL_TYPES,
  type FrustratedSessionRow,
  type SessionAnalysisReads,
  type SessionAnalysisView,
} from "../../recordings/interfaces";
import { maskPath } from "../../../platform/heuristics";
import { clock } from "../sessions/brief";
import { asLinks } from "./display";
import type { AiTool, ToolContext, ToolResult } from "./tool.types";

/**
 * The assistant's view of session recordings: which sessions went worst, and what happened
 * in one of them.
 *
 * Reads through the recordings module's `SessionAnalysisReads` port, injected at
 * composition, never its tables. The output is shaped for the model rather than passed
 * through — counts as one short string, times as `m:ss`, no ids it does not need — since
 * every token here is paid for again on each turn that replays it. The links to each
 * replay are drawn by the tool, never written by the model.
 */

/** Session ids are tracker-generated; anything else is not one, and never reaches a query. */
const SESSION_ID = /^[A-Za-z0-9_.:-]{1,128}$/;

const replayHref = (websiteId: string, sessionId: string) =>
  `/websites/${websiteId}/replays/${encodeURIComponent(sessionId)}`;

function countsText(counts: Record<string, number | undefined>): string {
  return Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
}

function compactRow(r: FrustratedSessionRow) {
  return {
    session_id: r.sessionId,
    started_at: r.startedAt,
    frustration_score: r.score,
    signals: countsText(r.counts),
    device: r.device,
    country: r.country,
    entry_page: maskPath(r.entryPage),
    duration_seconds: r.durationSeconds,
    pages: r.pagesViewed,
    ...(r.summary ? { summary: r.summary, outcome: r.outcome } : {}),
  };
}

export function compactAnalysis(v: SessionAnalysisView) {
  return {
    session_id: v.sessionId,
    started_at: v.startedAt,
    frustration_score: v.score,
    signals: countsText(v.counts),
    device: v.meta ? [v.meta.device, v.meta.browser, v.meta.os].filter(Boolean).join(" · ") : undefined,
    country: v.meta?.country || undefined,
    duration: v.timeline ? clock(v.timeline.durationMs) : undefined,
    pages: v.timeline?.pages.slice(0, 12).map((p) => `${clock(p.atMs)} ${p.path}`),
    ...(v.summary
      ? {
          summary: v.summary.text,
          intent: v.summary.intent,
          outcome: v.summary.outcome,
          moments: v.summary.moments.map((m) => `${clock(m.atMs)} ${m.label}`),
          summary_source: v.summarySource === "ai" ? "written by AI from the recording's signals" : "written from the signals by rules",
        }
      : { summary_status: v.summaryStatus }),
    frustration_moments: v.signals.slice(0, 10).map((s) =>
      [clock(s.atMs), s.type, "on", s.page, s.label ? `· ${s.label}` : "", s.count && s.count > 1 ? `x${s.count}` : "", s.detail ? `(${s.detail})` : ""]
        .filter(Boolean)
        .join(" "),
    ),
    errors: v.timeline?.errors.slice(0, 5).map((e) => `${clock(e.atMs)} ${e.page}: ${e.message}`),
  };
}

export function sessionTools(port: SessionAnalysisReads): AiTool<any>[] {
  const tool = <S extends z.ZodTypeAny>(
    name: string,
    description: string,
    schema: S,
    handler: (args: z.output<S>, ctx: ToolContext) => Promise<ToolResult>,
  ): AiTool<z.output<S>> => ({ name, kind: "read", description, schema, handler });

  const failed = (err: unknown): ToolResult => ({
    ok: false,
    error: err instanceof Error ? err.message.slice(0, 200) : "Read failed",
  });

  return [
    tool(
      "list_frustrated_sessions",
      "Session recordings where visitors struggled, worst first, with a 0-100 frustration score and " +
      "the signals found: rage_click, error_click, dead_click, u_turn, form_abandon, scroll_thrash. " +
      "Use for 'which sessions should I watch' or 'where are people getting stuck'. Includes the " +
      "stored summary when one exists. Recordings are analysed after the visit ends, so the newest " +
      "few may be missing.",
      z.object({
        days: z.number().int().min(1).max(90).default(7).describe("Look-back window in days (1-90)"),
        signal: z.enum(FRUSTRATION_SIGNAL_TYPES).optional().describe("Only sessions with this signal"),
        limit: z.number().int().min(1).max(25).default(10).describe("How many sessions to return (1-25)"),
      }),
      async (a, ctx) => {
        try {
          const rows = await port.listFrustrated(ctx.websiteId, { days: a.days, signal: a.signal, limit: a.limit });
          return {
            ok: true,
            data: {
              data: { days: a.days, sessions: rows.map(compactRow) },
              display: rows.length
                ? asLinks(rows.map((r) => ({
                    label: `Score ${r.score} · ${countsText(r.counts) || "no signals"}`,
                    sublabel: [r.device, r.country, maskPath(r.entryPage)].filter(Boolean).join(" · "),
                    href: replayHref(ctx.websiteId, r.sessionId),
                  })))
                : undefined,
            },
          };
        } catch (err) {
          return failed(err);
        }
      },
    ),

    tool(
      "get_session_summary",
      "What happened in one recorded session: pages in order, frustration moments with timestamps, " +
      "JavaScript errors, and a short summary with the visitor's likely intent and outcome " +
      "(succeeded, struggled or abandoned). Writes the summary if the session has none yet. " +
      "Needs a session id from list_frustrated_sessions or list_recent_sessions.",
      z.object({ sessionId: z.string().trim().min(1).max(128).describe("Session id") }),
      async (a, ctx) => {
        if (!SESSION_ID.test(a.sessionId)) {
          return { ok: false, error: "Not a session id. Call list_frustrated_sessions to find one." };
        }
        try {
          const view = await port.getAnalysis(ctx.websiteId, a.sessionId, { summarize: true });
          if (view.status === "not_found") return { ok: false, error: "No recorded session with that id on this website." };
          if (view.status === "pending") {
            return { ok: true, data: { data: { session_id: a.sessionId, status: "The recording has not been uploaded yet; try again shortly." } } };
          }
          return {
            ok: true,
            data: {
              data: compactAnalysis(view),
              display: asLinks([{
                label: "Watch this replay",
                sublabel: `Frustration score ${view.score}${view.summary ? ` · ${view.summary.outcome}` : ""}`,
                href: replayHref(ctx.websiteId, view.sessionId),
              }]),
            },
          };
        } catch (err) {
          return failed(err);
        }
      },
    ),
  ];
}
