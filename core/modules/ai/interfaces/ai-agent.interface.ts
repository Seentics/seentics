import type { ConversationSummary, ConversationTurn } from "./ai-repository.interface";

/**
 * The conversational assistant, as the controllers see it.
 *
 * Declared here rather than imported from the service because a controller may only
 * depend on interfaces — the HTTP-layering test enforces it, and the reason is that a
 * route should describe what it needs rather than bind to one implementation of it.
 */
export type AgentAnswer = {
  conversationId: string;
  queryId: string | null;
  answer: string;
  /** Typed render descriptors, one per tool result. Never model-authored. */
  blocks: unknown[];
  proposal: unknown;
  toolsUsed: string[];
  tokens: { input: number; output: number };
  estimatedCostUsd: number;
  executionTimeMs: number;
};

export interface AiAgent {
  ask(input: {
    userId: string;
    websiteId: string;
    prompt: string;
    conversationId?: string;
  }): Promise<AgentAnswer>;

  conversation(userId: string, conversationId: string): Promise<ConversationTurn[]>;

  /** This user's threads on one website, newest first. Backs the sidebar. */
  conversations(userId: string, websiteId: string): Promise<ConversationSummary[]>;
}

/** Creates the resource an approved draft describes. See `ProposalApplier`. */
export interface AiProposalApplier {
  apply(input: { userId: string; websiteId: string; queryId: string }): Promise<
    | { ok: true; created: { resource: string; id: string } }
    | { ok: false; error: string }
  >;
}
