import { randomUUID } from "node:crypto";
import type {
  AiRepository,
  ConversationTurn,
} from "../../interfaces/ai-repository.interface";
import { AIDailyLimitError } from "../../interfaces/ai.interface";
import type { ChatMessage, LlmClient } from "../../interfaces/llm-client.interface";
import { supportsToolCalling } from "../../interfaces/llm-client.interface";
import type { AiAgent } from "../../interfaces/ai-agent.interface";
import type { ToolRegistry } from "../../tools/registry";
import type { ActionProposal } from "../../tools/tool.types";
import { runAgent } from "./agent-loop";
import { isObviouslyOffTopic, OUT_OF_SCOPE_REPLY, SEENTICS_SCOPE } from "./scope";

/** Per-user rolling-24h cap, shared with the SQL path. 0 disables. */
const MAX_QUESTIONS_PER_DAY = Number(process.env.AI_MAX_QUERIES_PER_DAY ?? 200);
const DAY_MS = 86_400_000;

/**
 * How many earlier turns are replayed to the model.
 *
 * Enough for "and the week before?" to resolve, bounded because every replayed turn is
 * input tokens paid again on each question. Older turns fall out rather than the
 * conversation growing without limit.
 */
const HISTORY_TURNS = 6;

export type AskResult = {
  conversationId: string;
  queryId: string | null;
  answer: string;
  proposal: ActionProposal | null;
  toolsUsed: string[];
  tokens: { input: number; output: number };
  estimatedCostUsd: number;
  executionTimeMs: number;
};

/**
 * The conversational half of the AI module.
 *
 * Sits beside `NaturalLanguageQueryService` rather than replacing it: that one answers a
 * question by generating SQL, which is still the right tool for something no typed read
 * covers, and it keeps its own guard. This one answers by calling tools, which is
 * cheaper to make correct and impossible to mis-scope.
 */
export class AgentService implements AiAgent {
  constructor(
    private readonly repo: AiRepository,
    private readonly llm: LlmClient,
    private readonly registry: ToolRegistry,
    private readonly modelInfo: {
      model: string;
      inputCostPerToken: number;
      outputCostPerToken: number;
    },
  ) {}

  async ask(input: {
    userId: string;
    websiteId: string;
    prompt: string;
    conversationId?: string;
  }): Promise<AskResult> {
    const startedAt = Date.now();
    const conversationId = input.conversationId?.trim() || randomUUID();

    // Refused before the cap is touched and before anything is recorded: declining to
    // answer "write me a poem" should not consume someone's daily allowance.
    if (isObviouslyOffTopic(input.prompt)) {
      return {
        conversationId, queryId: null, answer: OUT_OF_SCOPE_REPLY, proposal: null,
        toolsUsed: [], tokens: { input: 0, output: 0 }, estimatedCostUsd: 0,
        executionTimeMs: Date.now() - startedAt,
      };
    }

    if (!supportsToolCalling(this.llm)) {
      throw new Error(
        "The configured AI model does not support tool calling, which the assistant " +
        "requires. Use a tool-capable model, or the SQL query mode.",
      );
    }

    await this.assertUnderDailyCap(input.userId);

    const history = await this.loadHistory(input.userId, conversationId);

    // Recorded before the call so an attempt that crashes still counts against the cap.
    const queryId = await this.repo.createPending({
      userId: input.userId,
      websiteUuid: input.websiteId,
      prompt: input.prompt,
      model: this.modelInfo.model,
      conversationId,
    });

    try {
      const run = await runAgent({
        llm: this.llm,
        registry: this.registry,
        ctx: { websiteId: input.websiteId, userId: input.userId },
        system: SEENTICS_SCOPE,
        history,
        question: input.prompt,
      });

      const estimatedCostUsd =
        run.inputTokens * this.modelInfo.inputCostPerToken +
        run.outputTokens * this.modelInfo.outputCostPerToken;
      const executionTimeMs = Date.now() - startedAt;

      if (queryId) {
        await this.repo.markAgentSuccess(queryId, {
          answer: run.answer,
          toolCalls: run.toolCalls,
          proposal: (run.proposal as unknown as Record<string, unknown>) ?? null,
          inputTokens: run.inputTokens,
          outputTokens: run.outputTokens,
          estimatedCostUsd,
          executionTimeMs,
        });
      }

      return {
        conversationId,
        queryId,
        answer: run.answer,
        proposal: run.proposal,
        toolsUsed: run.toolCalls.map((c) => c.name),
        tokens: { input: run.inputTokens, output: run.outputTokens },
        estimatedCostUsd,
        executionTimeMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI request failed";
      if (queryId) {
        await this.repo.markFailure(queryId, {
          errorMessage: message.slice(0, 500),
          executionTimeMs: Date.now() - startedAt,
        });
      }
      throw err;
    }
  }

  /** One conversation, oldest first. Scoped to its owner by the repository. */
  conversation(userId: string, conversationId: string): Promise<ConversationTurn[]> {
    return this.repo.conversation(userId, conversationId, 100);
  }

  /**
   * Replay earlier turns as chat messages.
   *
   * Only the question and the answer — tool calls and their results are not replayed.
   * They were already reduced to the answer the model gave, and replaying every tool
   * payload would spend the context budget on data the conversation has moved past.
   */
  private async loadHistory(userId: string, conversationId: string): Promise<ChatMessage[]> {
    const turns = await this.repo.conversation(userId, conversationId, HISTORY_TURNS * 2);
    const recent = turns.slice(-HISTORY_TURNS);

    const messages: ChatMessage[] = [];
    for (const t of recent) {
      messages.push({ role: "user", content: `<question>${t.prompt}</question>` });
      if (t.answer) messages.push({ role: "assistant", content: t.answer });
    }
    return messages;
  }

  private async assertUnderDailyCap(userId: string): Promise<void> {
    if (MAX_QUESTIONS_PER_DAY <= 0) return;
    const used = await this.repo.countQueriesSince(userId, new Date(Date.now() - DAY_MS));
    if (used >= MAX_QUESTIONS_PER_DAY) {
      throw new AIDailyLimitError(
        `AI daily limit reached (${MAX_QUESTIONS_PER_DAY} questions in 24 hours)`,
      );
    }
  }
}
