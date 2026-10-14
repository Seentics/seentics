import type { ConversationSummary, ConversationTurn } from "./ai-repository.interface";
import type { WebsiteRole } from "../../websites/interfaces";

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
    /** The recommendation the chat was started from; stored on the turn for the confirm step. */
    recommendationId?: string;
  }): Promise<AgentAnswer>;

  conversation(userId: string, conversationId: string): Promise<ConversationTurn[]>;

  /** This user's threads on one website, newest first. Backs the sidebar. */
  conversations(userId: string, websiteId: string): Promise<ConversationSummary[]>;
}

/**
 * Why a confirm was refused, for the HTTP status: `forbidden` (role or team permission), `stale`
 * (the target changed since the draft), `gone` (the draft, or its target, is no longer there).
 * Anything else is a plain refusal.
 */
export type ApplyFailureCode = "forbidden" | "stale" | "gone";

/** Applies what an approved draft describes. See `ProposalApplier`. */
export interface AiProposalApplier {
  apply(input: {
    userId: string;
    websiteId: string;
    queryId: string;
    role: WebsiteRole;
    can?: (permission: string) => boolean;
  }): Promise<
    | { ok: true; created: { resource: string; id: string }; operation: string }
    | { ok: false; error: string; code?: ApplyFailureCode }
  >;
}
