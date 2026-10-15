import { log as baseLog } from "../../../../platform/observability/logger";
import { alertOps } from "../../../../platform/observability/ops-alert";
import { AIDailyLimitError } from "../../interfaces/ai.interface";
import type { ChatTurn, LlmClient, LlmCompletion, ToolCallingLlmClient } from "../../interfaces/llm-client.interface";
import { supportsToolCalling } from "../../interfaces/llm-client.interface";

const log = baseLog.child({ category: "ai_budget" });

/**
 * One ceiling on what the model may cost a day, across every feature, site and account.
 *
 * Each feature has its own allowance (questions per user, summaries and heatmap write-ups per
 * site, one insight per site a day), but those multiply with the number of sites and members.
 * This is the backstop that does not: once the day's spend reaches AI_DAILY_BUDGET_USD, every
 * model call is refused until midnight UTC. The assistant then says so; everything else falls
 * back to its template, as it does when no model is configured.
 *
 * Counted in this process from each answer's token counts and the configured prices, so it is
 * per process (the API and the worker each have the ceiling) and starts again on a restart.
 * `0` turns it off.
 */
export class AiBudgetExceededError extends AIDailyLimitError {
  constructor() {
    super("Seentics AI has reached today's usage limit. It will be back tomorrow.");
    this.name = "AiBudgetExceededError";
  }
}

const ledger = { day: "", usd: 0, warned: false };
const today = (now: Date) => now.toISOString().slice(0, 10);

export function dailyBudgetUsd(env: NodeJS.ProcessEnv = process.env): number {
  const v = Number(env.AI_DAILY_BUDGET_USD ?? 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Throws when today's spend has reached the ceiling. */
export function assertWithinBudget(budget = dailyBudgetUsd(), now = new Date()): void {
  if (budget <= 0) return;
  if (ledger.day !== today(now)) Object.assign(ledger, { day: today(now), usd: 0, warned: false });
  if (ledger.usd >= budget) {
    if (!ledger.warned) {
      ledger.warned = true;
      log.error({ msg: "ai_daily_budget_reached", budget_usd: budget, spent_usd: Number(ledger.usd.toFixed(4)) });
      void alertOps("Seentics AI reached its daily budget", {
        budget_usd: budget, spent_usd: Number(ledger.usd.toFixed(4)), until: "midnight UTC", raise_with: "AI_DAILY_BUDGET_USD",
      });
    }
    throw new AiBudgetExceededError();
  }
}

export function recordSpend(usd: number, now = new Date()): void {
  if (!(usd > 0)) return;
  if (ledger.day !== today(now)) Object.assign(ledger, { day: today(now), usd: 0, warned: false });
  ledger.usd += usd;
}

export function spentToday(now = new Date()): number {
  return ledger.day === today(now) ? ledger.usd : 0;
}

/** For tests. */
export function resetBudget(): void {
  Object.assign(ledger, { day: "", usd: 0, warned: false });
}

type Prices = { inputCostPerToken: number; outputCostPerToken: number };

/** The client, with every call checked against the ceiling and its cost added to the day's spend. */
export function withDailyBudget<T extends LlmClient>(client: T, prices: Prices): T {
  const cost = (t: { inputTokens: number; outputTokens: number }) =>
    t.inputTokens * prices.inputCostPerToken + t.outputTokens * prices.outputCostPerToken;
  const guarded: LlmClient = {
    async complete(system, user): Promise<LlmCompletion> {
      assertWithinBudget();
      const r = await client.complete(system, user);
      recordSpend(cost(r));
      return r;
    },
    async classify(system, user): Promise<string> {
      assertWithinBudget();
      return client.classify(system, user);
    },
  };
  if (!supportsToolCalling(client)) return guarded as T;
  const tools = client as ToolCallingLlmClient;
  return {
    ...guarded,
    supportsTools: true,
    async chat(input): Promise<ChatTurn> {
      assertWithinBudget();
      const r = await tools.chat(input);
      recordSpend(cost(r));
      return r;
    },
  } as ToolCallingLlmClient as unknown as T;
}
