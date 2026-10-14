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

/** What accepting a draft does. `archive` is a soft archive or deactivation — never a delete. */
export type ProposalOperation = 'create' | 'update' | 'set_status' | 'archive';

/** One value in a before/after diff: one line, or a compact list (steps, actions). */
export type ProposalDiffValue = string | string[] | null;

/** One changed field, as the server built it from the validated draft. */
export interface ProposalChange {
  field: string;
  label: string;
  before: ProposalDiffValue;
  after: ProposalDiffValue;
}

/**
 * A callout the card shows before the confirm button: goes live, stops something, changes what
 * the site collects, reaches outside Seentics, or changes who is alerted. Server-worded.
 */
export interface ProposalRisk {
  kind: 'live' | 'stops' | 'data' | 'external' | 'alerts';
  message: string;
}

/** A draft awaiting approval. Nothing has been created or changed. */
export interface ActionProposal {
  resource: string;
  /** Absent on drafts stored before operations existed: those are all creates. */
  operation?: ProposalOperation;
  /** What a non-create draft changes, and its version when drafted. */
  target?: { id: string; version: string };
  payload: unknown;
  /** The least role that may confirm. Absent on older drafts, which all needed a member. */
  requiredRole?: 'member' | 'admin';
  diff?: ProposalChange[];
  summary: {
    title: string;
    lines: string[];
    /** Webhook or redirect — the two that reach outside the product. Warned on. */
    hasExternalEffect: boolean;
    risks?: ProposalRisk[];
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
  /** Why applying the proposal failed. Shown on the proposal card, cleared on retry. */
  proposalError?: string;
  /** The server refused it as out of date; the card then asks for a fresh draft. */
  proposalStale?: boolean;
  toolsUsed?: string[];
  /** Per-message cost, shown to operators. */
  usage?: { tokens: { input: number; output: number }; costUsd: number; ms: number };
  pending?: boolean;
  error?: string;
}

/** One thread in the sidebar, titled by the question that opened it. */
export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
}
