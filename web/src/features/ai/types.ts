/** Domain types for the AI assistant. */

/**
 * How a tool result should be drawn.
 *
 * Mirrors `modules/ai/tools/display.ts` on the server. The union is closed and the
 * renderer has one component per `kind` — the model never authors markup, it only
 * writes the prose around these.
 */
export type DisplayBlock =
  | {
      kind: 'metrics';
      items: Array<{
        label: string;
        value: number | string;
        delta?: number | null;
        format?: ValueFormat;
      }>;
    }
  | {
      kind: 'table';
      columns: Array<{ key: string; label: string; format?: ValueFormat }>;
      rows: Array<Record<string, unknown>>;
    }
  | {
      kind: 'timeseries';
      xKey: string;
      series: Array<{ key: string; label: string }>;
      rows: Array<Record<string, unknown>>;
    }
  | {
      kind: 'funnel';
      steps: Array<{ label: string; value: number; conversionRate?: number }>;
    }
  | {
      kind: 'links';
      items: Array<{ label: string; sublabel?: string; href: string }>;
    };

export type ValueFormat = 'number' | 'percent' | 'duration' | 'currency';

/** A draft awaiting approval. Nothing has been created. */
export interface ActionProposal {
  resource: string;
  operation: 'create';
  payload: unknown;
  summary: {
    title: string;
    lines: string[];
    /** Webhook or redirect — the two that reach outside the product. Warned on. */
    hasExternalEffect: boolean;
  };
}

export interface AskResponse {
  conversationId: string;
  queryId: string | null;
  answer: string;
  blocks: DisplayBlock[];
  proposal: ActionProposal | null;
  toolsUsed: string[];
  tokens: { input: number; output: number };
  estimatedCostUsd: number;
  executionTimeMs: number;
}

/** One stored exchange, as the conversation endpoint returns it. */
export interface ConversationTurn {
  id: string;
  prompt: string;
  answer: string | null;
  proposal: ActionProposal | null;
  proposalAppliedAt: string | null;
  status: string;
  createdAt: string;
}

/** What the UI keeps per message. Wider than a stored turn: it holds the blocks. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks?: DisplayBlock[];
  proposal?: ActionProposal | null;
  /** Set once a proposal on this message has been created. */
  proposalApplied?: boolean;
  toolsUsed?: string[];
  /** Per-message cost, shown to operators. */
  usage?: { tokens: { input: number; output: number }; costUsd: number; ms: number };
  pending?: boolean;
  error?: string;
}
