import type {
  ChatMessage,
  ToolCallRequest,
  ToolCallingLlmClient,
} from "../../interfaces/llm-client.interface";
import type { ToolRegistry } from "../../tools/registry";
import { forModel } from "./model-view";
import type { ActionProposal, ToolContext } from "../../tools/tool.types";

/**
 * How many model turns one question may take.
 *
 * Each turn is a paid call, so this is the cost ceiling for a single question as much as
 * a termination guarantee. Four is enough for the shape these questions have — look
 * something up, look up a second thing it implied, answer — and a model still asking for
 * tools after four is looping rather than working.
 */
const MAX_TURNS = 4;

/** Total tool calls across all turns, so one turn cannot fan out without bound. */
const MAX_TOOL_CALLS = 8;

/**
 * Tool output is capped before it goes back to the model.
 *
 * A query can legitimately return hundreds of rows, and feeding all of them back costs
 * tokens for context the answer does not need. Truncation is announced in the payload so
 * the model reports "top 50" rather than presenting a slice as the whole.
 */
const MAX_TOOL_RESULT_CHARS = 6_000;

export type AgentRun = {
  answer: string;
  /**
   * How to draw each tool's result, in the order the tools ran.
   *
   * Collected from the tools, not the model. The model is fed only `data`; the display
   * block goes straight to the client, so nothing the model writes can influence how a
   * result is rendered.
   */
  blocks: unknown[];
  /** Every tool that ran, in order — the audit trail stored against the query. */
  toolCalls: Array<{ name: string; args: unknown; ok: boolean }>;
  /** The draft awaiting approval, if a propose tool produced one. */
  proposal: ActionProposal | null;
  inputTokens: number;
  outputTokens: number;
  turns: number;
  /** True when the loop hit a ceiling rather than the model finishing. */
  truncated: boolean;
};

/**
 * Run one question to an answer, calling tools as the model asks for them.
 *
 * The loop is deliberately plain: ask, run what it asked for, feed the results back, ask
 * again, stop when it answers or a ceiling is hit. What keeps it safe is not the loop but
 * what the tools can do — reads are tenant-bound by `ToolContext` and writes do not
 * exist, only drafts.
 *
 * A proposal ends the run. Once the model has drafted something for a person to approve,
 * continuing would let it call more tools on the strength of a change that has not been
 * accepted, and the next thing the user does is accept or decline rather than ask again.
 */
export async function runAgent(input: {
  llm: ToolCallingLlmClient;
  registry: ToolRegistry;
  ctx: ToolContext;
  system: string;
  /** Prior turns, oldest first. Already trimmed by the caller. */
  history: ChatMessage[];
  question: string;
}): Promise<AgentRun> {
  const { llm, registry, ctx, system } = input;
  const tools = registry.schemas();

  const messages: ChatMessage[] = [
    ...input.history,
    // Delimited so the model can tell the question from everything around it. The same
    // reason the SQL path wraps questions in <question> tags.
    { role: "user", content: `<question>${input.question}</question>` },
  ];

  const executed: AgentRun["toolCalls"] = [];
  const blocks: unknown[] = [];
  let proposal: ActionProposal | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let truncated = false;
  let turns = 0;

  // Prose the model wrote during this run only. `messages` also holds replayed history,
  // whose answers must not be glued onto this one.
  const ownText: string[] = [];

  while (turns < MAX_TURNS) {
    turns++;
    // The last turn, or the tool budget spent: tools are withheld so the model answers from
    // what it has already read, rather than the run ending on a canned "couldn't finish".
    // On the final turn reads are withheld, so the model answers from what it has; drafts stay
    // available, so a change it has finished researching can still be proposed.
    const final = turns === MAX_TURNS || executed.length >= MAX_TOOL_CALLS;
    const finalTools = final ? tools.filter((t) => t.name.startsWith("propose_")) : tools;
    if (final && turns > 1) {
      messages.push({
        role: "user",
        content: "No more reads are available for this question. Answer now from the tool results above " +
          "(or draft the change, if that is what was asked): lead with what they show, and say what you could not check.",
      });
    }
    const turn = await llm.chat({
      system,
      messages,
      tools: finalTools,
      ...(final && finalTools.length === 0 ? { toolChoice: "none" as const } : {}),
    });
    inputTokens += turn.inputTokens;
    outputTokens += turn.outputTokens;

    if (turn.stopReason === "refusal") {
      return {
        answer: turn.text.trim() || "I can't help with that one.",
        blocks, toolCalls: executed, proposal, inputTokens, outputTokens, turns, truncated,
      };
    }

    if (turn.stopReason === "max_tokens") {
      // The reply was cut off. A tool call in it may carry half its arguments, so nothing
      // in this turn is run; the partial prose is kept but marked as partial.
      const partial = turn.text.trim();
      return {
        answer: partial
          ? `${partial}…\n\n(This answer was cut short. Try a narrower question.)`
          : "That answer ran too long to finish. Try a narrower question.",
        blocks, toolCalls: executed, proposal, inputTokens, outputTokens, turns, truncated: true,
      };
    }

    if (turn.toolCalls.length === 0 || (final && finalTools.length === 0 && turn.text.trim())) {
      return {
        answer: turn.text.trim(),
        blocks, toolCalls: executed, proposal, inputTokens, outputTokens, turns, truncated,
      };
    }

    const calls = turn.toolCalls.slice(0, Math.max(0, MAX_TOOL_CALLS - executed.length));
    if (calls.length < turn.toolCalls.length) truncated = true;

    if (turn.text.trim()) ownText.push(turn.text.trim());
    // The provider's raw turn (thinking included) is replayed unchanged, so every call in
    // it is answered below — run, or refused for being over the limit.
    messages.push({
      role: "assistant",
      content: turn.text,
      toolCalls: turn.toolCalls,
      ...(turn.raw ? { raw: turn.raw } : {}),
    });

    for (const call of calls) {
      const result = await registry.run(call.name, call.args, ctx);
      executed.push({ name: call.name, args: call.args, ok: result.ok });

      if (result.ok) {
        const captured = captureProposal(result.data);
        if (captured) proposal = captured;
        const display = (result.data as { display?: unknown } | null)?.display;
        if (display) blocks.push(display);
      }

      messages.push(toolMessage(call, result));
    }
    for (const call of turn.toolCalls.slice(calls.length)) {
      messages.push(toolMessage(call, { ok: false, error: "Not run: the tool-call limit for this question was reached." }));
    }

    if (proposal) {
      // A draft is the end of the turn. The user's next move is to accept or decline.
      const closing = ownText.join(" ").trim();
      return {
        answer: closing ? withConfirmNote(closing) : describeDraft(proposal),
        blocks, toolCalls: executed, proposal, inputTokens, outputTokens, turns, truncated,
      };
    }

    if (executed.length >= MAX_TOOL_CALLS) truncated = true;
  }

  // Out of turns with no prose answer. Say so rather than returning an empty string,
  // which would render as the assistant having replied with nothing.
  return {
    answer:
      "I wasn't able to finish that one — it needed more steps than I can take in a " +
      "single question. Try narrowing it down.",
    blocks, toolCalls: executed, proposal, inputTokens, outputTokens, turns, truncated: true,
  };
}

/**
 * The reply for a draft the model proposed without writing anything itself: what will change,
 * from the draft's own summary, and that nothing has changed yet.
 */
function describeDraft(p: ActionProposal): string {
  const lines = (p.summary?.lines ?? []).filter(Boolean).slice(0, 2).join(" ");
  const title = p.summary?.title?.trim();
  const what = title ? `I've drafted this change: ${title}.` : "I've drafted this change.";
  return `${what}${lines ? ` ${lines}` : ""} Nothing changes until you review and confirm it below.`;
}

/** The model's own words, plus the reminder that a draft still needs confirming if it left that out. */
function withConfirmNote(text: string): string {
  return /\b(confirm|review|approve)\b/i.test(text)
    ? text
    : `${text} Nothing changes until you review and confirm it below.`;
}

function toolMessage(
  call: ToolCallRequest,
  result: { ok: true; data: unknown } | { ok: false; error: string },
): ChatMessage {
  // Only `data` reaches the model, and only as forModel leaves it: no identifiers. The
  // display block is presentation, and sending it would invite the model to argue with it.
  const body = result.ok
    ? JSON.stringify(forModel((result.data as { data?: unknown })?.data ?? result.data))
    : JSON.stringify({ error: result.error });

  const content =
    body.length > MAX_TOOL_RESULT_CHARS
      // Announced, not silent: the model must report a slice as a slice.
      ? `${body.slice(0, MAX_TOOL_RESULT_CHARS)}\n[truncated — report these as partial results]`
      : body;

  return { role: "tool", toolCallId: call.id, name: call.name, content, isError: !result.ok };
}

/** A `propose_*` tool returns `{ proposal }`; everything else returns plain data. */
function captureProposal(data: unknown): ActionProposal | null {
  const p = (data as { proposal?: unknown } | null)?.proposal;
  if (!p || typeof p !== "object") return null;
  const candidate = p as ActionProposal;
  return candidate.resource && candidate.operation ? candidate : null;
}
