import { log as baseLog } from "../../../platform/observability/logger";
import type { LlmClient } from "../interfaces/llm-client.interface";
import { numbersIn } from "../insights/brief";
import { extractJson } from "../insights/output";
import { count, looksPersonal, maskPath, maskText } from "../../../platform/heuristics";
import type { ExplanationRecord } from "./repository";
import type { Detection } from "./types";

/**
 * One sentence of likely cause for a new anomaly.
 *
 * The figures come from the data: the pages and sources whose pageviews moved most between the
 * anomaly's window and the same window a week earlier, and the error's page. A rule words them
 * whenever there is something to say. A model, when configured, may word it better — but only
 * from the brief it was given: a sentence with a number the brief does not contain, or anything
 * that looks like personal data, is thrown away and the rule's sentence is kept.
 */

const log = baseLog.child({ category: "ai_anomalies" });

export type Mover = { name: string; cur: number; ref: number };
/** What changed around the anomaly. Names are masked before they get here. */
export type ExplainContext = { pages: Mover[]; sources: Mover[] };

export type ModelInfo = { name: string; inputCostPerToken: number; outputCostPerToken: number };

const MAX_TEXT = 300;
/** Small whole numbers that carry no claim of their own. */
const FREE_NUMBERS = new Set(["1", "2", "3", "4", "7", "24"]);

/** The context with every page path and source name masked: what may be stored, shown or sent to a model. */
export function maskContext(raw: ExplainContext): ExplainContext {
  return {
    pages: raw.pages.map((p) => ({ ...p, name: maskPath(p.name) })),
    sources: raw.sources.map((s) => ({ ...s, name: maskText(s.name, 60) || "direct" })),
  };
}

/** The mover that went furthest in the anomaly's direction: down for a drop, up for a spike. */
function biggest(movers: Mover[], dir: 1 | -1): Mover | null {
  let best: Mover | null = null;
  for (const m of movers) {
    const delta = dir * (m.cur - m.ref);
    if (delta > 0 && (!best || delta > dir * (best.cur - best.ref))) best = m;
  }
  return best;
}

/** The rule's sentence, or `null` when the data says nothing useful. */
export function ruleExplanation(d: Detection, ctx: ExplainContext | null): string | null {
  if (d.type === "tracking_outage") {
    return "Pageviews stopped almost entirely, which usually means the tracking script was removed, blocked or failed to load, for example after a deploy or a consent banner change.";
  }
  if (d.type === "error_surge") {
    const page = typeof d.facts.page === "string" && d.facts.page ? maskPath(d.facts.page) : null;
    if (d.facts.isNew === 1) return page ? `A new error, thrown mostly on ${page}: likely a recent release.` : "A new error that was not thrown before: likely a recent release.";
    return page ? `It is thrown mostly on ${page}, so visitors on that page are the ones affected.` : null;
  }
  if (!ctx) return null;
  const dir: 1 | -1 = d.type === "traffic_spike" ? 1 : -1;
  const source = biggest(ctx.sources, dir);
  const page = biggest(ctx.pages, dir);
  const pick = [source && { kind: "source" as const, m: source }, page && { kind: "page" as const, m: page }]
    .filter((x): x is { kind: "source" | "page"; m: Mover } => Boolean(x))
    .sort((a, b) => Math.abs(b.m.cur - b.m.ref) - Math.abs(a.m.cur - a.m.ref))[0];
  if (!pick) return null;
  const { m } = pick;
  const where = pick.kind === "source" ? `traffic from ${m.name}` : `pageviews of ${m.name}`;
  if (d.type === "traffic_spike") return `Most of the rise came from ${where}: ${count(m.cur)} against ${count(m.ref)} at the same time a week earlier.`;
  if (d.type === "conversion_drop") return `Fewer visitors reached it: ${where} fell to ${count(m.cur)} from ${count(m.ref)} a week earlier.`;
  return `The biggest fall is in ${where}: ${count(m.cur)} against ${count(m.ref)} at the same time a week earlier.`;
}

const SYSTEM_PROMPT = `You explain one website analytics anomaly to the site's owner in ONE short sentence of likely cause.
Use only the facts in the brief. Never invent numbers, pages, sources or causes the facts do not support; when unsure, say what the data shows rather than guessing.
Plain English, no jargon, no greeting, at most 200 characters.
Answer with JSON only: {"explanation": "<one sentence>"}`;

/** The brief a model is shown, and every number in it (the only numbers its answer may use). */
export function buildBrief(d: Detection, ctx: ExplainContext | null, rule: string | null): { text: string; numbers: Set<string> } {
  const lines = [
    `anomaly: ${d.type.replace(/_/g, " ")}`,
    `what: ${d.title}`,
    `detail: ${d.summary}`,
  ];
  if (ctx?.sources.length) {
    lines.push("", "sources (pageviews now vs same time a week earlier):");
    for (const s of ctx.sources) lines.push(`${s.name}: ${count(s.cur)} vs ${count(s.ref)}`);
  }
  if (ctx?.pages.length) {
    lines.push("", "pages (pageviews now vs same time a week earlier):");
    for (const p of ctx.pages) lines.push(`${p.name}: ${count(p.cur)} vs ${count(p.ref)}`);
  }
  if (d.type === "error_surge" && typeof d.facts.page === "string" && d.facts.page) lines.push(`error page: ${maskPath(d.facts.page)}`);
  if (rule) lines.push("", `a template would say: ${rule}`);
  const text = lines.join("\n").slice(0, 2_500);
  return { text, numbers: numbersIn(text) };
}

/** The model's sentence if it passes every check, else `null` with why. */
export function checkModelSentence(raw: string, briefNumbers: Set<string>): { text: string | null; why?: string } {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { text: null, why: "not JSON" };
  }
  const value = parsed && typeof parsed === "object" ? (parsed as { explanation?: unknown }).explanation : undefined;
  if (typeof value !== "string") return { text: null, why: "no explanation" };
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 12) return { text: null, why: "too short" };
  if (text.length > MAX_TEXT) return { text: null, why: "too long" };
  if (looksPersonal(text)) return { text: null, why: "looks like personal data" };
  const invented = [...numbersIn(text)].filter((n) => !briefNumbers.has(n) && !FREE_NUMBERS.has(n));
  if (invented.length) return { text: null, why: `numbers not in the data: ${invented.join(", ")}` };
  return { text };
}

/** Writes an anomaly's explanation: the model's sentence when it passes, the rule's otherwise. */
export class AnomalyExplainer {
  constructor(private readonly deps: { llm: LlmClient | null; model: ModelInfo | null }) {}

  get configured(): boolean {
    return !!this.deps.llm && !!this.deps.model;
  }

  async explain(d: Detection, rawContext: ExplainContext | null): Promise<ExplanationRecord> {
    const ctx = rawContext ? maskContext(rawContext) : null;
    const rule = ruleExplanation(d, ctx);
    const fromRules: ExplanationRecord = { text: rule, source: rule ? "rules" : null, model: null, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const { llm, model } = this.deps;
    // An outage's cause is the rule's: nothing in the data narrows it down further.
    if (!llm || !model || d.type === "tracking_outage") return fromRules;

    const brief = buildBrief(d, ctx, rule);
    try {
      const completion = await llm.complete(SYSTEM_PROMPT, brief.text);
      const spent = {
        model: model.name,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        costUsd: completion.inputTokens * model.inputCostPerToken + completion.outputTokens * model.outputCostPerToken,
      };
      const checked = checkModelSentence(completion.content, brief.numbers);
      if (!checked.text) {
        log.info({ msg: "ai_anomaly_explanation_rejected", type: d.type, why: checked.why });
        return { ...fromRules, ...spent };
      }
      return { text: checked.text, source: "ai", ...spent };
    } catch (err) {
      log.warn({ msg: "ai_anomaly_explanation_failed", type: d.type, err: String(err) });
      return fromRules;
    }
  }
}
