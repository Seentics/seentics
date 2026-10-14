import type { AiRepository, ConversationTurn } from "../../modules/ai/interfaces/ai-repository.interface";
import type { ChatMessage, ChatTurn, ToolCallingLlmClient } from "../../modules/ai/interfaces/llm-client.interface";
import { AgentService } from "../../modules/ai/services/agent/agent.service";
import { forModel } from "../../modules/ai/services/agent/model-view";
import { ToolRegistry } from "../../modules/ai/tools/registry";
import type { ActionProposal, ToolContext, ToolResult } from "../../modules/ai/tools/tool.types";
import { CASES, type AgentCase } from "./cases";
import { SITE, buildFixtureRegistry } from "./fixtures";
import { grade, passed, type AgentRunRecord, type Axis, type Grade } from "./graders";
import { pool, type MeteredClient } from "./llm";

/** Records what each tool returned, exactly as the model was shown it. */
class RecordingRegistry extends ToolRegistry {
  results: string[] = [];
  calls: Array<{ name: string; args: unknown; ok: boolean }> = [];
  override async run(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const r = await super.run(name, rawArgs, ctx);
    this.calls.push({ name, args: rawArgs, ok: r.ok });
    this.results.push(r.ok ? JSON.stringify(forModel((r.data as { data?: unknown })?.data ?? r.data)).slice(0, 6000) : JSON.stringify({ error: r.error }));
    return r;
  }
}

/** One question's view of the shared client: counts its own turns and tokens. */
function perCase(llm: MeteredClient) {
  const stats = { turns: 0, inputTokens: 0, outputTokens: 0 };
  const client: ToolCallingLlmClient = {
    supportsTools: true,
    complete: (s, u) => llm.complete(s, u),
    classify: (s, u) => llm.classify(s, u),
    async chat(input: { system: string; messages: ChatMessage[]; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }> }): Promise<ChatTurn> {
      const t = await llm.chat(input);
      stats.turns += 1; stats.inputTokens += t.inputTokens; stats.outputTokens += t.outputTokens;
      return t;
    },
  };
  return { client, stats };
}

/** Only what `AgentService.ask` touches: history, the cap and the audit row. */
function memoryRepo(history: Array<{ q: string; a: string }>): AiRepository {
  const turns: ConversationTurn[] = history.map((h, i) => ({
    id: `h${i}`, prompt: h.q, answer: h.a, proposal: null, proposalAppliedAt: null, status: "success", createdAt: new Date(Date.UTC(2026, 9, 14, 8, i)).toISOString(),
  }));
  const noop = async () => undefined;
  return {
    countQueriesSince: async () => 0,
    createPending: async () => "q-eval",
    markAgentSuccess: noop,
    markFailure: noop,
    conversation: async () => turns,
  } as unknown as AiRepository;
}

export type AgentCaseResult = {
  id: string;
  split: string;
  category: string;
  question: string;
  answer: string;
  tools: Array<{ name: string; args: unknown; ok: boolean }>;
  proposal: { resource: string; operation: string; target?: unknown; payload: unknown } | null;
  grade: Grade;
  pass: boolean;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
  judge?: Record<string, number> | null;
  sample?: number;
  /** What the model was shown, kept so a result can be re-graded without another model call. */
  toolResults: string[];
  history: string;
};

const JUDGE_PROMPT = `You grade an analytics assistant's answer. Score 1-5 each:
- grounded: every figure and name comes from the tool data shown; nothing invented.
- helpful: answers exactly what was asked, specific (names the page/source/element), concise.
- actionable: ends with one concrete next step tied to the data, or correctly drafts the requested change without claiming it is done.
Reply JSON only: {"grounded":n,"helpful":n,"actionable":n}`;

export async function runAgentSuite(llm: MeteredClient, opts: { split: "train" | "test" | "all"; only?: string[]; concurrency: number; judge: boolean; repeat: number }): Promise<AgentCaseResult[]> {
  const cases = CASES.filter((c) => (opts.split === "all" || c.split === opts.split) && (!opts.only?.length || opts.only.includes(c.id)));
  // Each case `repeat` times: one sample of a sampled model is an anecdote.
  const jobs = cases.flatMap((c) => Array.from({ length: Math.max(1, opts.repeat) }, (_, sample) => ({ c, sample })));
  return pool(jobs, opts.concurrency, async ({ c, sample }) => ({ ...(await runOne(llm, c, opts.judge)), sample }));
}

async function runOne(llm: MeteredClient, c: AgentCase, judge: boolean): Promise<AgentCaseResult> {
  const { registry: fixtureRegistry } = buildFixtureRegistry();
  const registry = new RecordingRegistry(fixtureRegistry.list());
  const { client, stats } = perCase(llm);
  const agent = new AgentService(memoryRepo(c.history ?? []), client, registry, {
    model: llm.model, inputCostPerToken: llm.cfg.inputCostPerToken, outputCostPerToken: llm.cfg.outputCostPerToken,
  });

  let answer = "";
  let proposal: ActionProposal | null = null;
  let error: string | undefined;
  try {
    const r = await agent.ask({ userId: "eval-user", websiteId: SITE, prompt: c.question, conversationId: c.history?.length ? "conv-eval" : undefined });
    answer = r.answer;
    proposal = r.proposal;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const record: AgentRunRecord = {
    answer, proposal, question: c.question,
    history: (c.history ?? []).map((h) => `${h.q}\n${h.a}`).join("\n"),
    toolNames: registry.calls.map((t) => t.name), toolCalls: registry.calls, toolResults: registry.results,
    toolText: registry.results.join("\n"),
  };
  const g = grade(c, record);
  if (error) g.helpful = [...(g.helpful ?? []), `error: ${error.slice(0, 160)}`];
  const axes: Axis[] = ["correct", "helpful", "actionable", "safe"];
  const pass = axes.every((a) => passed(g, a) !== false);

  let judged: Record<string, number> | null = null;
  if (judge && !error && answer) {
    try {
      const j = await llm.complete(JUDGE_PROMPT, JSON.stringify({
        question: c.question, history: record.history || undefined,
        tool_data: registry.results.join("\n").slice(0, 5000),
        draft: proposal ? { resource: proposal.resource, operation: proposal.operation, summary: proposal.summary } : null,
        answer,
      }));
      judged = JSON.parse(j.content.slice(j.content.indexOf("{"), j.content.lastIndexOf("}") + 1));
    } catch { judged = null; }
  }

  return {
    id: c.id, split: c.split, category: c.category, question: c.question, answer,
    tools: registry.calls, proposal: proposal ? { resource: proposal.resource, operation: proposal.operation, target: proposal.target, payload: proposal.payload } : null,
    grade: g, pass, toolResults: registry.results, history: record.history, turns: stats.turns, inputTokens: stats.inputTokens, outputTokens: stats.outputTokens,
    costUsd: stats.inputTokens * llm.cfg.inputCostPerToken + stats.outputTokens * llm.cfg.outputCostPerToken,
    ...(error ? { error } : {}), ...(judge ? { judge: judged } : {}),
  };
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

export function summariseAgent(results: AgentCaseResult[]) {
  const axes: Axis[] = ["correct", "helpful", "actionable", "safe"];
  const axis = Object.fromEntries(axes.map((a) => {
    const applicable = results.filter((r) => r.grade[a] !== null);
    return [a, pct(applicable.filter((r) => r.grade[a]!.length === 0).length, applicable.length)];
  }));
  // Tool-call accuracy: expected tool groups met, over cases that name any.
  let groups = 0, met = 0;
  for (const r of results) {
    const c = CASES.find((x) => x.id === r.id)!;
    for (const g of c.tools ?? []) { groups++; if (g.some((t) => r.tools.some((x) => x.name === t))) met++; }
  }
  const n = results.length || 1;
  const judged = results.filter((r) => r.judge);
  const avgJudge = judged.length
    ? Object.fromEntries(["grounded", "helpful", "actionable"].map((k) => [k, Math.round((judged.reduce((s, r) => s + (r.judge?.[k] ?? 0), 0) / judged.length) * 100) / 100]))
    : null;
  return {
    cases: results.length,
    pass_pct: pct(results.filter((r) => r.pass).length, results.length),
    ...axis,
    tool_call_accuracy_pct: pct(met, groups),
    avg_tool_calls: Math.round((results.reduce((s, r) => s + r.tools.length, 0) / n) * 100) / 100,
    avg_turns: Math.round((results.reduce((s, r) => s + r.turns, 0) / n) * 100) / 100,
    avg_input_tokens: Math.round(results.reduce((s, r) => s + r.inputTokens, 0) / n),
    avg_output_tokens: Math.round(results.reduce((s, r) => s + r.outputTokens, 0) / n),
    avg_cost_usd: Math.round((results.reduce((s, r) => s + r.costUsd, 0) / n) * 1e6) / 1e6,
    ...(avgJudge ? { judge_avg: avgJudge } : {}),
  };
}

/** Grade a stored result again with the current graders (no model call). */
export function regrade(r: AgentCaseResult): AgentCaseResult {
  const c = CASES.find((x) => x.id === r.id);
  if (!c) return r;
  const record: AgentRunRecord = {
    answer: r.answer, proposal: r.proposal as ActionProposal | null, question: r.question, history: r.history ?? "",
    toolNames: r.tools.map((t) => t.name), toolCalls: r.tools, toolResults: r.toolResults ?? [], toolText: (r.toolResults ?? []).join("\n"),
  };
  const g = grade(c, record);
  if (r.error) g.helpful = [...(g.helpful ?? []), `error: ${r.error.slice(0, 160)}`];
  const axes: Axis[] = ["correct", "helpful", "actionable", "safe"];
  return { ...r, grade: g, pass: axes.every((a) => passed(g, a) !== false) };
}
