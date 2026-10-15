import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { LlmClient, ToolCallingLlmClient } from "../interfaces/llm-client.interface";
import { AIDailyLimitError } from "../interfaces/ai.interface";
import { AiBudgetExceededError, assertWithinBudget, dailyBudgetUsd, recordSpend, resetBudget, spentToday, withDailyBudget } from "../services/llm/budget";

const PRICES = { inputCostPerToken: 0.001, outputCostPerToken: 0.002 };
const fake = (): LlmClient & { calls: number } => ({
  calls: 0,
  async complete() { this.calls++; return { content: "ok", inputTokens: 1000, outputTokens: 500 }; },
  async classify() { this.calls++; return "x"; },
});

describe("the daily AI budget", () => {
  const prev = process.env.AI_DAILY_BUDGET_USD;
  beforeEach(() => { resetBudget(); process.env.AI_DAILY_BUDGET_USD = "5"; });
  afterEach(() => { process.env.AI_DAILY_BUDGET_USD = prev; });

  it("adds each answer's cost and refuses calls once the day's ceiling is reached", async () => {
    const inner = fake();
    const llm = withDailyBudget(inner, PRICES);
    await llm.complete("s", "u");
    expect(spentToday()).toBeCloseTo(2, 6); // 1000 × 0.001 + 500 × 0.002
    await llm.complete("s", "u");
    await llm.complete("s", "u");
    expect(spentToday()).toBeCloseTo(6, 6);
    await expect(llm.complete("s", "u")).rejects.toBeInstanceOf(AiBudgetExceededError);
    await expect(llm.classify("s", "u")).rejects.toBeInstanceOf(AIDailyLimitError);
    expect(inner.calls).toBe(3);
  });

  it("starts again the next UTC day, and is off at 0", () => {
    recordSpend(9, new Date("2026-10-15T23:00:00Z"));
    expect(() => assertWithinBudget(5, new Date("2026-10-15T23:30:00Z"))).toThrow(AiBudgetExceededError);
    expect(() => assertWithinBudget(5, new Date("2026-10-16T00:01:00Z"))).not.toThrow();
    expect(dailyBudgetUsd({ AI_DAILY_BUDGET_USD: "0" })).toBe(0);
    expect(() => assertWithinBudget(0)).not.toThrow();
  });

  it("guards the assistant's tool-calling turns too", async () => {
    let turns = 0;
    const tools = {
      ...fake(),
      supportsTools: true as const,
      async chat() { turns++; return { text: "", toolCalls: [], inputTokens: 3000, outputTokens: 0 }; },
    } as unknown as ToolCallingLlmClient;
    const llm = withDailyBudget(tools, PRICES) as ToolCallingLlmClient;
    expect(llm.supportsTools).toBe(true);
    await llm.chat({ system: "s", messages: [], tools: [] });
    await llm.chat({ system: "s", messages: [], tools: [] });
    await expect(llm.chat({ system: "s", messages: [], tools: [] })).rejects.toBeInstanceOf(AiBudgetExceededError);
    expect(turns).toBe(2);
  });
});
