import type {
  ChatMessage,
  ToolCallRequest,
  ToolCallingLlmClient,
} from "../../interfaces/llm-client.interface";
import type { ToolRegistry } from "../../tools/registry";
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

  while (turns < MAX_TURNS) {
    turns++;
    const turn = await llm.chat({ system, messages, tools });
    inputTokens += turn.inputTokens;
    outputTokens += turn.outputTokens;

    if (turn.toolCalls.length === 0) {
      return {
        answer: turn.text.trim(),
        blocks, toolCalls: executed, proposal, inputTokens, outputTokens, turns, truncated,
      };
    }

    const calls = turn.toolCalls.slice(0, Math.max(0, MAX_TOOL_CALLS - executed.length));
    if (calls.length < turn.toolCalls.length) truncated = true;

    messages.push({ role: "assistant", content: turn.text, toolCalls: calls });

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

    if (proposal) {
      // A draft is the end of the turn. The user's next move is to accept or decline.
      const closing = messages
        .filter((m) => m.role === "assistant")
        .map((m) => m.content)
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        answer: closing || "I've drafted this for you to review.",
        blocks, toolCalls: executed, proposal, inputTokens, outputTokens, turns, truncated,
      };
    }

    if (executed.length >= MAX_TOOL_CALLS) {
      truncated = true;
      break;
    }
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

function toolMessage(
  call: ToolCallRequest,
  result: { ok: true; data: unknown } | { ok: false; error: string },
): ChatMessage {
  // Only `data` reaches the model. The display block is presentation, and sending it
  // would invite the model to argue with it.
  const body = result.ok
    ? JSON.stringify((result.data as { data?: unknown })?.data ?? result.data)
    : JSON.stringify({ error: result.error });

  const content =
    body.length > MAX_TOOL_RESULT_CHARS
      // Announced, not silent: the model must report a slice as a slice.
      ? `${body.slice(0, MAX_TOOL_RESULT_CHARS)}\n[truncated — report these as partial results]`
      : body;

  return { role: "tool", toolCallId: call.id, name: call.name, content };
}

/** A `propose_*` tool returns `{ proposal }`; everything else returns plain data. */
function captureProposal(data: unknown): ActionProposal | null {
  const p = (data as { proposal?: unknown } | null)?.proposal;
  if (!p || typeof p !== "object") return null;
  const candidate = p as ActionProposal;
  return candidate.resource && candidate.operation ? candidate : null;
}
