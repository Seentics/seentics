import type { AiRepository } from "../../modules/ai/interfaces/ai-repository.interface";
import type { LlmClient } from "../../modules/ai/interfaces/llm-client.interface";
import { buildBrief as buildInsightBrief } from "../../modules/ai/insights/brief";
import { parseModelOutput } from "../../modules/ai/insights/output";
import { INSIGHT_SYSTEM_PROMPT } from "../../modules/ai/insights/prompts";
import { detectSignals } from "../../modules/ai/insights/signals";
import { steadySnapshot, troubledSnapshot } from "../../modules/ai/insights/tests/fixtures";
import type { InsightSnapshot } from "../../modules/ai/insights/types";
import { buildSessionBrief } from "../../modules/ai/sessions/brief";
import { parseSessionSummary } from "../../modules/ai/sessions/output";
import { SESSION_SUMMARY_SYSTEM_PROMPT } from "../../modules/ai/sessions/prompts";
import { ruleSummary } from "../../platform/heuristics";
import { buildHeatmapBrief } from "../../modules/ai/heatmap-insights/brief";
import { parseHeatmapOutput } from "../../modules/ai/heatmap-insights/output";
import { HEATMAP_INSIGHT_SYSTEM_PROMPT } from "../../modules/ai/heatmap-insights/prompts";
import { AnomalyExplainer, ruleExplanation, type ExplainContext } from "../../modules/ai/anomalies/explain";
import type { Detection } from "../../modules/ai/anomalies/types";
import { acceptSentence, createImpactNarrator, type ImpactFacts } from "../../modules/ai/recommendations/narration";
import { NaturalLanguageQueryService } from "../../modules/ai/services/natural-language-query.service";
import type { AIDomain } from "../../modules/ai/interfaces/ai-query.types";
import { analysePage, tagFromSelector, type ClickRow, type ScrollRow } from "../../modules/heatmaps/lib/heatmap-insights";
import type { SessionSummaryInput } from "../../modules/recordings/interfaces";
import { pool, type MeteredClient } from "./llm";

/**
 * The single-shot generators, each run through its real brief, prompt and output validator. A
 * case fails when the model's wording would have been thrown away (the product then falls back to
 * template text), or when it passes the validator but is vague, unactionable or claims too much.
 */

export type GenResult = { suite: string; id: string; pass: boolean; reasons: string[]; output: unknown; inputTokens: number; outputTokens: number };

const CLAIMS = /\b(has been|have been|was|were) (fixed|changed|moved|updated|applied|resolved)\b|\bI(?:'ve| have) (changed|fixed|moved|applied)/i;
const CAUSAL_CERTAIN = /\b(because|caused by|due to)\b/i;
const HEDGE = /\b(possibly|likely|may|might|could|probably|suggests?)\b/i;
const IMPERATIVE = /\b(move|add|fix|check|review|investigate|shorten|make|test|try|consider|restyle|replace|remove|place|put|show|draft|set up|reduce|simplify|look|watch|compare|update|reach out|redirect|create|prioriti[sz]e|bring|raise|turn|use|give|target|follow)\b/i;

/** A view of the shared client that counts only this case's tokens (cases run concurrently). */
function tracked(llm: MeteredClient) {
  const stats = { i: 0, o: 0 };
  const client: LlmClient = {
    async complete(s, u) { const r = await llm.complete(s, u); stats.i += r.inputTokens; stats.o += r.outputTokens; return r; },
    async classify(s, u) { const r = await llm.classify(s, u); stats.i += Math.ceil((s.length + u.length) / 4) + 8; stats.o += 10; return r; },
  };
  return { client, stats };
}

async function measured<T>(llm: MeteredClient, fn: (client: LlmClient) => Promise<T>): Promise<{ value: T; i: number; o: number }> {
  const { client, stats } = tracked(llm);
  const value = await fn(client);
  return { value, i: stats.i, o: stats.o };
}

// ─── Daily insights ─────────────────────────────────────────────────────────────

const pair = (cur: number, prev: number) => ({ cur, prev });

const northwindSnapshot = (): InsightSnapshot => steadySnapshot({
  traffic: { visitors: pair(4180, 5120), pageviews: pair(12950, 15400), sessions: pair(5020, 6050), bounceRate: pair(52.4, 44.1), avgSessionSec: pair(96, 121) },
  devices: [
    { name: "Desktop", sessions: pair(3100, 3600), bounceRate: pair(44, 41), conversions: pair(150, 168) },
    { name: "Mobile", sessions: pair(1800, 2300), bounceRate: pair(68, 50), conversions: pair(40, 92) },
  ],
  channels: [
    { name: "google", visitors: pair(1850, 2300), sessions: pair(2200, 2700), pagesPerSession: pair(2.6, 2.7), bounceRate: pair(41, 39) },
    { name: "twitter.com", visitors: pair(610, 380), sessions: pair(700, 420), pagesPerSession: pair(1.3, 1.6), bounceRate: pair(71, 55) },
    { name: "newsletter", visitors: pair(260, 250), sessions: pair(300, 290), pagesPerSession: pair(4.4, 4.2), bounceRate: pair(30, 31) },
  ],
  pages: [{ path: "/", views: pair(4100, 5000) }, { path: "/pricing", views: pair(2240, 2600) }, { path: "/checkout", views: pair(690, 1150) }, { path: "/signup", views: pair(1380, 1500) }],
  conversion: { event: "signup_completed", count: pair(212, 290) },
  errors: [{ message: "TypeError: Cannot read properties of undefined (reading 'total')", page: "/checkout", count: 312, isNew: true }],
});

const spikeSnapshot = (): InsightSnapshot => steadySnapshot({
  traffic: { visitors: pair(9100, 5000), pageviews: pair(21000, 14000), sessions: pair(10400, 6000), bounceRate: pair(58, 42), avgSessionSec: pair(70, 120) },
  channels: [
    { name: "news.ycombinator.com", visitors: pair(3900, 40), sessions: pair(4200, 45), pagesPerSession: pair(1.4, 2.0), bounceRate: pair(78, 50) },
    { name: "google", visitors: pair(2250, 2200), sessions: pair(2650, 2600), pagesPerSession: pair(2.3, 2.3), bounceRate: pair(41, 41) },
  ],
  pages: [{ path: "/blog/why-we-left-the-cloud", views: pair(6100, 30) }, { path: "/", views: pair(4200, 4000) }, { path: "/pricing", views: pair(1600, 1500) }],
});

const INSIGHT_CASES: Array<{ id: string; snap: () => InsightSnapshot }> = [
  { id: "insights-troubled", snap: troubledSnapshot },
  { id: "insights-northwind", snap: northwindSnapshot },
  { id: "insights-hn-spike", snap: spikeSnapshot },
];

async function insightCase(llm: MeteredClient, c: (typeof INSIGHT_CASES)[number]): Promise<GenResult> {
  const snap = c.snap();
  const signals = detectSignals(snap);
  const brief = buildInsightBrief(snap, signals);
  const { value, i, o } = await measured(llm, (m) => m.complete(INSIGHT_SYSTEM_PROMPT, brief.text));
  const reasons: string[] = [];
  let parsed: ReturnType<typeof parseModelOutput> | null = null;
  try { parsed = parseModelOutput(value.content, signals, brief.numbers); } catch (e) { reasons.push(`unparseable: ${String(e).slice(0, 80)}`); }
  if (parsed) {
    const want = Math.min(3, signals.length);
    if (parsed.lines.length < want) reasons.push(`kept ${parsed.lines.length} of ${want} lines`);
    for (const d of parsed.dropped) reasons.push(`validator dropped ${d.signal}: ${d.why}`);
    const actionable = signals.some((s) => s.action);
    const actions = parsed.lines.filter((l) => l.kind === "action");
    if (actionable && !actions.length) reasons.push("no action line though an action was possible");
    for (const a of actions) if (!IMPERATIVE.test(a.text)) reasons.push(`action line is not an instruction: "${a.text.slice(0, 60)}"`);
    for (const l of parsed.lines) {
      if (!/\d/.test(l.text)) reasons.push(`line without a figure: "${l.text.slice(0, 60)}"`);
      if (CLAIMS.test(l.text)) reasons.push(`claims a change: "${l.text.slice(0, 60)}"`);
      if (CAUSAL_CERTAIN.test(l.text) && !HEDGE.test(l.text)) reasons.push(`unhedged cause: "${l.text.slice(0, 60)}"`);
    }
  }
  return { suite: "insights", id: c.id, pass: reasons.length === 0, reasons, output: parsed?.lines ?? value.content, inputTokens: i, outputTokens: o };
}

// ─── Session summaries ──────────────────────────────────────────────────────────

const SESSION_INPUTS: Array<{ id: string; input: SessionSummaryInput; outcome: string; mention: RegExp }> = [
  {
    id: "session-checkout-rage", outcome: "abandoned", mention: /Apply coupon|apply-coupon|Pay now|place-order/i,
    input: {
      websiteId: "w", sessionId: "s1", device: "Mobile", browser: "Safari", os: "iOS", country: "US", score: 86,
      counts: { rage_click: 2, error_click: 2, form_abandon: 1 },
      signals: [
        { type: "rage_click", atMs: 192_000, page: "/checkout", label: "button#apply-coupon \"Apply coupon\"", count: 7 },
        { type: "error_click", atMs: 201_000, page: "/checkout", label: "button#apply-coupon \"Apply coupon\"", detail: "Failed to fetch: POST /api/coupons/apply" },
        { type: "rage_click", atMs: 236_000, page: "/checkout", label: "button#place-order \"Pay now\"", count: 5 },
        { type: "error_click", atMs: 240_000, page: "/checkout", label: "button#place-order \"Pay now\"", detail: "TypeError: Cannot read properties of undefined (reading 'total')" },
        { type: "form_abandon", atMs: 300_000, page: "/checkout", detail: "4 fields filled, never submitted" },
      ],
      timeline: {
        durationMs: 412_000,
        pages: [{ path: "/cart", atMs: 0, dwellMs: 65_000 }, { path: "/checkout", atMs: 65_000, dwellMs: 275_000 }, { path: "/cart", atMs: 340_000, dwellMs: 22_000 }, { path: "/checkout", atMs: 362_000, dwellMs: 40_000 }],
        clicks: [{ atMs: 60_000, page: "/cart", label: "a#go-checkout \"Checkout\"" }, { atMs: 192_000, page: "/checkout", label: "button#apply-coupon \"Apply coupon\"" }, { atMs: 236_000, page: "/checkout", label: "button#place-order \"Pay now\"" }],
        errors: [{ atMs: 201_000, page: "/checkout", message: "Failed to fetch: POST /api/coupons/apply" }, { atMs: 240_000, page: "/checkout", message: "TypeError: Cannot read properties of undefined (reading 'total')" }],
        errorCount: 3, failedRequests: 2, fieldsTouched: 4, goal: { reached: false },
      },
    },
  },
  {
    id: "session-smooth-signup", outcome: "succeeded", mention: /\/signup|\/welcome|sign(ed)? ?up/i,
    input: {
      websiteId: "w", sessionId: "s2", device: "Desktop", browser: "Chrome", os: "macOS", country: "DE", score: 8, counts: {},
      signals: [],
      timeline: {
        durationMs: 154_000,
        pages: [{ path: "/", atMs: 0, dwellMs: 30_000 }, { path: "/pricing", atMs: 30_000, dwellMs: 50_000 }, { path: "/signup", atMs: 80_000, dwellMs: 60_000 }, { path: "/welcome", atMs: 140_000, dwellMs: 14_000 }],
        clicks: [{ atMs: 25_000, page: "/", label: "a.nav-pricing \"Pricing\"" }, { atMs: 78_000, page: "/pricing", label: "a#start-trial \"Start free trial\"" }, { atMs: 138_000, page: "/signup", label: "button[type=submit] \"Create account\"" }],
        errors: [], errorCount: 0, failedRequests: 0, fieldsTouched: 3, goal: { reached: true, page: "/welcome", atMs: 140_000 },
      },
    },
  },
  {
    id: "session-pricing-uturn", outcome: "abandoned", mention: /plan card|plan-card|Pro|\/pricing/i,
    input: {
      websiteId: "w", sessionId: "s3", device: "Desktop", browser: "Chrome", os: "Windows", country: "DE", score: 64, counts: { dead_click: 4, u_turn: 1 },
      signals: [
        { type: "dead_click", atMs: 41_000, page: "/pricing", label: "div.plan-card \"Pro\"", count: 4 },
        { type: "u_turn", atMs: 95_000, page: "/features", detail: "back to /pricing after 4s" },
      ],
      timeline: {
        durationMs: 188_000,
        pages: [{ path: "/pricing", atMs: 0, dwellMs: 90_000 }, { path: "/features", atMs: 90_000, dwellMs: 5_000 }, { path: "/pricing", atMs: 95_000, dwellMs: 93_000 }],
        clicks: [{ atMs: 41_000, page: "/pricing", label: "div.plan-card \"Pro\"" }, { atMs: 88_000, page: "/pricing", label: "a.nav-features \"Features\"" }],
        errors: [], errorCount: 0, failedRequests: 0, fieldsTouched: 0, goal: { reached: false },
      },
    },
  },
];

async function sessionCase(llm: MeteredClient, c: (typeof SESSION_INPUTS)[number]): Promise<GenResult> {
  const brief = buildSessionBrief(c.input);
  const { value, i, o } = await measured(llm, (m) => m.complete(SESSION_SUMMARY_SYSTEM_PROMPT, brief.text));
  const reasons: string[] = [];
  let out: ReturnType<typeof parseSessionSummary> | null = null;
  try { out = parseSessionSummary(value.content, brief, ruleSummary(c.input)); } catch (e) { reasons.push(`rejected: ${String(e).slice(0, 120)}`); }
  if (out) {
    for (const d of out.dropped) reasons.push(`validator dropped ${d}`);
    if (out.summary.outcome !== c.outcome) reasons.push(`outcome ${out.summary.outcome}, expected ${c.outcome}`);
    if (!c.mention.test(out.summary.text)) reasons.push("summary does not name the page or element that mattered");
    if (c.input.signals.length && !out.summary.moments.length) reasons.push("no moments to jump to");
    if (out.summary.text.length > 520) reasons.push("summary too long");
  }
  return { suite: "sessions", id: c.id, pass: reasons.length === 0, reasons, output: out?.summary ?? value.content, inputTokens: i, outputTokens: o };
}

// ─── Heatmap insights ───────────────────────────────────────────────────────────

const scroll = (device: string, depth: number, views: number, fold: number, viewportPx: number, documentPx: number): ScrollRow => ({ device, depth, views, fold, viewportPx, documentPx });
const click = (device: string, selector: string, y: number, clicks: number, extra: Partial<ClickRow> = {}): ClickRow => ({
  device, selector, band: Math.min(9, Math.floor(y / 1000)), clicks, yWeighted: y * clicks, tag: tagFromSelector(selector), role: null, annotated: false, pinned: false, ...extra,
});

const HEATMAP_CASES = [
  {
    id: "heatmap-pricing-cta-below-fold", mention: /start-trial/,
    analysis: () => analysePage({
      pagePath: "/pricing", days: 30, device: "all",
      scrollRows: [
        scroll("desktop", 30, 140, 30, 900, 3000), scroll("desktop", 55, 120, 30, 900, 3000), scroll("desktop", 80, 90, 30, 900, 3000), scroll("desktop", 100, 50, 30, 900, 3000),
        scroll("mobile", 18, 170, 18, 740, 4100), scroll("mobile", 40, 80, 18, 740, 4100), scroll("mobile", 75, 30, 18, 740, 4100), scroll("mobile", 100, 20, 18, 740, 4100),
      ],
      clickRows: [
        click("desktop", "a#start-trial", 7200, 96), click("desktop", "div.plan-card", 4200, 140), click("desktop", "nav a.logo", 200, 60, { pinned: true }),
        click("desktop", "button#billing-toggle", 2500, 70), click("desktop", "a.faq-link", 8800, 25),
        click("mobile", "a#start-trial", 7400, 18), click("mobile", "div.plan-card", 4000, 88), click("mobile", "button#billing-toggle", 2600, 30), click("mobile", "nav a.logo", 300, 22, { pinned: true }),
      ],
    }),
  },
  {
    id: "heatmap-home-dead-clicks", mention: /hero-shot|img/,
    analysis: () => analysePage({
      pagePath: "/", days: 30, device: "all",
      scrollRows: [scroll("desktop", 40, 300, 35, 900, 2600), scroll("desktop", 70, 250, 35, 900, 2600), scroll("desktop", 100, 150, 35, 900, 2600), scroll("mobile", 30, 260, 20, 740, 3700), scroll("mobile", 60, 140, 20, 740, 3700)],
      clickRows: [click("desktop", "img.hero-shot", 2500, 210), click("desktop", "a#hero-signup", 1500, 160), click("desktop", "a.nav-pricing", 200, 180, { pinned: true }), click("mobile", "img.hero-shot", 2600, 90), click("mobile", "a#hero-signup", 1700, 60)],
    }),
  },
];

async function heatmapCase(llm: MeteredClient, c: (typeof HEATMAP_CASES)[number]): Promise<GenResult> {
  const a = c.analysis();
  const brief = buildHeatmapBrief(a);
  const { value, i, o } = await measured(llm, (m) => m.complete(HEATMAP_INSIGHT_SYSTEM_PROMPT, brief.text));
  const reasons: string[] = [];
  let out: ReturnType<typeof parseHeatmapOutput> | null = null;
  try { out = parseHeatmapOutput(value.content, a.signals, brief.numbers); } catch (e) { reasons.push(`unparseable: ${String(e).slice(0, 80)}`); }
  if (out) {
    const want = Math.min(2, a.signals.length);
    if (out.findings.length < want) reasons.push(`kept ${out.findings.length} findings, want ${want}`);
    for (const d of out.dropped) reasons.push(`validator dropped ${d.signal}: ${d.why}`);
    if (!out.findings.some((f) => c.mention.test(`${f.finding} ${f.fix}`))) reasons.push("never names the key element");
    for (const f of out.findings) {
      if (!IMPERATIVE.test(f.fix)) reasons.push(`fix is not an instruction: "${f.fix.slice(0, 60)}"`);
      if (CLAIMS.test(f.fix)) reasons.push("fix claims a change");
      if (!/\d/.test(f.finding)) reasons.push(`finding without a figure: "${f.finding.slice(0, 60)}"`);
    }
  }
  return { suite: "heatmap", id: c.id, pass: reasons.length === 0, reasons, output: out?.findings ?? value.content, inputTokens: i, outputTokens: o };
}

// ─── Anomaly explanations ───────────────────────────────────────────────────────

const win = { start: new Date("2026-10-12T12:00:00Z"), end: new Date("2026-10-12T18:00:00Z") };
const det = (over: Partial<Detection> & Pick<Detection, "type" | "title" | "summary">): Detection => ({
  subject: "", verdict: "anomalous", severity: "high", metric: "pageviews", observed: 1240, expected: 2000, score: -4.2, window: win, path: "", facts: {}, ...over,
});

const ANOMALY_CASES: Array<{ id: string; d: Detection; ctx: ExplainContext | null; mention: RegExp }> = [
  {
    id: "anomaly-traffic-drop", mention: /twitter/i,
    d: det({ type: "traffic_drop", title: "Traffic dropped 38%", summary: "1,240 pageviews between 12:00 and 18:00 UTC, against a usual 2,000." }),
    ctx: { sources: [{ name: "twitter.com", cur: 180, ref: 690 }, { name: "google", cur: 610, ref: 650 }, { name: "direct", cur: 300, ref: 330 }], pages: [{ name: "/blog/markdown-tips", cur: 150, ref: 560 }, { name: "/", cur: 420, ref: 470 }] },
  },
  {
    id: "anomaly-spike", mention: /ycombinator|hacker news|\/blog\/why-we-left-the-cloud/i,
    d: det({ type: "traffic_spike", title: "Traffic up 3.1x", summary: "6,200 pageviews between 12:00 and 18:00 UTC, against a usual 2,000.", observed: 6200, score: 9.1 }),
    ctx: { sources: [{ name: "news.ycombinator.com", cur: 3900, ref: 12 }, { name: "google", cur: 640, ref: 650 }], pages: [{ name: "/blog/why-we-left-the-cloud", cur: 4100, ref: 20 }, { name: "/", cur: 900, ref: 800 }] },
  },
  {
    id: "anomaly-error-surge", mention: /\/checkout|release|deploy/i,
    d: det({ type: "error_surge", metric: "errors", title: "New error on /checkout", summary: "TypeError: Cannot read properties of undefined (reading 'total') was thrown 140 times in 6 hours; it was never seen before.", observed: 140, expected: 0, facts: { page: "/checkout", isNew: 1 } }),
    ctx: null,
  },
  {
    id: "anomaly-conversion-drop", mention: /\/pricing|google/i,
    d: det({ type: "conversion_drop", metric: "conversions", title: "Signups down 55%", summary: "18 signup_completed events between 12:00 and 18:00 UTC, against a usual 40.", observed: 18, expected: 40 }),
    ctx: { sources: [{ name: "google", cur: 400, ref: 620 }, { name: "direct", cur: 300, ref: 310 }], pages: [{ name: "/pricing", cur: 210, ref: 520 }, { name: "/signup", cur: 120, ref: 210 }] },
  },
];

async function anomalyCase(llm: MeteredClient, c: (typeof ANOMALY_CASES)[number]): Promise<GenResult> {
  const model = { name: llm.model, inputCostPerToken: llm.cfg.inputCostPerToken, outputCostPerToken: llm.cfg.outputCostPerToken };
  const { value, i, o } = await measured(llm, (m) => new AnomalyExplainer({ llm: m, model }).explain(c.d, c.ctx));
  const reasons: string[] = [];
  if (value.source !== "ai") reasons.push(`model sentence rejected; fell back to ${value.source}`);
  if (!value.text || !c.mention.test(value.text)) reasons.push("does not name the biggest mover");
  if (value.text && CAUSAL_CERTAIN.test(value.text) && !HEDGE.test(value.text)) reasons.push("unhedged cause");
  return { suite: "anomaly", id: c.id, pass: reasons.length === 0, reasons, output: { text: value.text, rule: ruleExplanation(c.d, c.ctx) }, inputTokens: i, outputTokens: o };
}

// ─── Impact narration ───────────────────────────────────────────────────────────

const IMPACT_CASES: Array<{ id: string; facts: ImpactFacts; expect: RegExp }> = [
  { id: "impact-improved", facts: { headline: "/signup: bounce rate −9 pts after 14 days (61% → 52%)", verdict: "improved", extra: ["sessions before: 1,000", "sessions after: 1,000"] }, expect: /fell|dropped|down|lower|improv|decreas/i },
  { id: "impact-worse", facts: { headline: "Checkout funnel: conversion −4.1 pts after 7 days (22.4% → 18.3%)", verdict: "worse", extra: ["entries before: 1,640", "entries after: 820"] }, expect: /fell|dropped|down|lower|worse|decreas/i },
  { id: "impact-no-change", facts: { headline: "/pricing: bounce rate +0.6 pts after 7 days (47.2% → 47.8%)", verdict: "no_change", extra: ["sessions before: 2,100", "sessions after: 1,050"] }, expect: /no clear change|no (meaningful|significant|real) change|not (a )?clear|within normal/i },
  { id: "impact-too-little", facts: { headline: "/docs/getting-started: bounce rate −12 pts after 7 days (50% → 38%)", verdict: "too_little_data", extra: ["sessions before: 40", "sessions after: 21"] }, expect: /too (little|few)|not enough|too early/i },
];

async function impactCase(llm: MeteredClient, c: (typeof IMPACT_CASES)[number]): Promise<GenResult> {
  const { value, i, o } = await measured(llm, (m) => createImpactNarrator(m).word(c.facts));
  const reasons: string[] = [];
  if (value.source !== "ai") reasons.push("model sentence rejected; fell back to the rule sentence");
  if (!c.expect.test(value.sentence)) reasons.push("sentence does not match the verdict");
  if (value.source === "ai" && !acceptSentence(value.sentence, c.facts)) reasons.push("accepted a sentence the validator rejects");
  return { suite: "impact", id: c.id, pass: reasons.length === 0, reasons, output: value, inputTokens: i, outputTokens: o };
}

// ─── SQL mode ───────────────────────────────────────────────────────────────────

const SQL_CASES: Array<{ id: string; q: string; domain: AIDomain; columns: RegExp[]; viz?: string[] }> = [
  { id: "sql-visitors-30d", q: "How many unique visitors did we have in the last 30 days?", domain: "analytics", columns: [/\bvalue\b|visitors/i], viz: ["number"] },
  { id: "sql-top-pages", q: "Top 10 pages by pageviews this month", domain: "analytics", columns: [/\bpage\b/, /\bcount\b|views|pageviews/i], viz: ["bar_chart", "table"] },
  { id: "sql-daily-trend", q: "Pageviews per day for the last 14 days", domain: "analytics", columns: [/\bday\b|date/i, /\bcount\b|views|pageviews/i], viz: ["line_chart"] },
  { id: "sql-device-split", q: "What share of visitors use mobile vs desktop?", domain: "analytics", columns: [/device/i], viz: ["pie_chart", "bar_chart", "table"] },
  { id: "sql-revenue-source", q: "Revenue by utm source last 30 days", domain: "revenue", columns: [/source/i, /revenue|total/i] },
  { id: "sql-funnels-active", q: "How many active funnels do we have?", domain: "funnels", columns: [/\bvalue\b|count|funnels/i], viz: ["number", "table"] },
  { id: "sql-replays-errors", q: "How many recorded sessions had errors this week?", domain: "replays", columns: [/\bvalue\b|count|sessions/i] },
  { id: "sql-automation-runs", q: "Which automations fired the most in the last 7 days?", domain: "automations", columns: [/name|automation/i, /count|runs|executions|total|fired/i] },
];

async function sqlCase(llm: MeteredClient, c: (typeof SQL_CASES)[number]): Promise<GenResult> {
  const ran: string[] = [];
  const repo = {
    countQueriesSince: async () => 0, createPending: async () => null, markSuccess: async () => undefined, markFailure: async () => undefined,
    runGuarded: async (sql: string) => { ran.push(sql); return []; },
  } as unknown as AiRepository;
  const reasons: string[] = [];
  let result: Awaited<ReturnType<NaturalLanguageQueryService["run"]>> | null = null;
  const { i, o } = await measured(llm, async (m) => {
    const svc = new NaturalLanguageQueryService(repo, m, { model: llm.model, inputCostPerToken: llm.cfg.inputCostPerToken, outputCostPerToken: llm.cfg.outputCostPerToken });
    try { result = await svc.run("eval-user", "5e1f0000-0000-4000-8000-000000000001", c.q, "auto"); } catch (e) { reasons.push(String(e instanceof Error ? e.message : e).slice(0, 200)); }
  });
  const r = result as Awaited<ReturnType<NaturalLanguageQueryService["run"]>> | null;
  if (r) {
    const cols = r.columns.map((x) => x.key).join(" ");
    const aliases = `${cols} ${r.sql}`;
    for (const re of c.columns) if (!re.test(aliases)) reasons.push(`missing column ${re}`);
    if (c.viz && !c.viz.includes(r.viz_type)) reasons.push(`viz ${r.viz_type}, expected ${c.viz.join("|")}`);
    if (!r.insight) reasons.push("no insight");
  }
  return { suite: "sql", id: c.id, pass: reasons.length === 0, reasons, output: r ? { sql: r.sql, viz: r.viz_type, columns: r.columns, title: r.title, insight: r.insight } : null, inputTokens: i, outputTokens: o };
}

export const GENERATOR_SUITES = ["insights", "sessions", "heatmap", "anomaly", "impact", "sql"] as const;
export type GeneratorSuite = (typeof GENERATOR_SUITES)[number];

export async function runGenerators(llm: MeteredClient, suites: GeneratorSuite[], concurrency: number, repeat = 1): Promise<GenResult[]> {
  const once: Array<() => Promise<GenResult>> = [];
  const jobs = { push: (j: () => Promise<GenResult>) => once.push(j) };
  if (suites.includes("insights")) for (const c of INSIGHT_CASES) jobs.push(() => insightCase(llm, c));
  if (suites.includes("sessions")) for (const c of SESSION_INPUTS) jobs.push(() => sessionCase(llm, c));
  if (suites.includes("heatmap")) for (const c of HEATMAP_CASES) jobs.push(() => heatmapCase(llm, c));
  if (suites.includes("anomaly")) for (const c of ANOMALY_CASES) jobs.push(() => anomalyCase(llm, c));
  if (suites.includes("impact")) for (const c of IMPACT_CASES) jobs.push(() => impactCase(llm, c));
  if (suites.includes("sql")) for (const c of SQL_CASES) jobs.push(() => sqlCase(llm, c));
  const all = Array.from({ length: Math.max(1, repeat) }, () => once).flat();
  return pool(all, concurrency, (j) => j());
}
