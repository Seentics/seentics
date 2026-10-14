import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ChatMessage, ChatTurn, LlmCompletion, ToolCallingLlmClient } from "../../modules/ai/interfaces/llm-client.interface";
import { OpenAiCompatibleClient } from "../../modules/ai/services/llm/openai-compatible-client";
import { readAiProviderConfig, type AiProviderConfig } from "../../modules/ai/services/llm/provider-config";

/**
 * The real production client, wrapped for evaluation: every call is metered against a spend
 * ledger kept on disk (tokens and dollars only), a 429 is retried with backoff, and a call that
 * would start past the budget is refused.
 *
 * The key is read from the repository's `.env` at runtime (or the environment) and only ever
 * handed to the SDK. It is never printed, logged or written anywhere.
 */

export const RESULTS_DIR = join(import.meta.dir, "results");
const LEDGER = join(RESULTS_DIR, "spend.json");

/** Hard ceiling across every eval run of this task, in USD. */
export const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD ?? 1.4);

type Ledger = { inputTokens: number; outputTokens: number; costUsd: number; calls: number; runs: Array<{ at: string; label: string; costUsd: number; calls: number }> };

function readLedger(): Ledger {
  if (!existsSync(LEDGER)) return { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0, runs: [] };
  return JSON.parse(readFileSync(LEDGER, "utf8")) as Ledger;
}

function apiKeyFromDotEnv(): string | undefined {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  // seentics/core/evals/ai -> the enterprise workspace root, then the seentics repo root
  for (const dir of [resolve(import.meta.dir, "../../../.."), resolve(import.meta.dir, "../../..")]) {
    const file = join(dir, ".env");
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8").split(/\r?\n/).find((l) => /^\s*OPENAI_API_KEY\s*=/.test(l));
    const value = line?.replace(/^\s*OPENAI_API_KEY\s*=\s*/, "").trim().replace(/^["']|["']$/g, "");
    if (value) return value;
  }
  return undefined;
}

export class BudgetExceeded extends Error {}

export class MeteredClient implements ToolCallingLlmClient {
  readonly supportsTools = true as const;
  readonly cfg: AiProviderConfig;
  private readonly inner: OpenAiCompatibleClient;
  private ledger: Ledger;
  /** This process only. */
  run = { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 };

  constructor(private readonly label: string, opts: { maxOutputTokens?: number } = {}) {
    const key = apiKeyFromDotEnv();
    if (!key) throw new Error("OPENAI_API_KEY not found in the environment or .env");
    const cfg = readAiProviderConfig({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: key,
      AI_MODEL: process.env.EVAL_MODEL ?? "gpt-6-luna",
      ...(opts.maxOutputTokens ? { AI_MAX_OUTPUT_TOKENS: String(opts.maxOutputTokens) } : {}),
      AI_TIMEOUT_MS: "60000",
    } as NodeJS.ProcessEnv);
    if (!cfg) throw new Error("could not build the provider config");
    this.cfg = cfg;
    this.inner = new OpenAiCompatibleClient(cfg);
    this.ledger = readLedger();
  }

  get model(): string { return this.cfg.model; }
  get totalSpendUsd(): number { return this.ledger.costUsd; }

  private cost(i: number, o: number) { return i * this.cfg.inputCostPerToken + o * this.cfg.outputCostPerToken; }

  private account(i: number, o: number) {
    const c = this.cost(i, o);
    this.run.inputTokens += i; this.run.outputTokens += o; this.run.costUsd += c; this.run.calls += 1;
    this.ledger.inputTokens += i; this.ledger.outputTokens += o; this.ledger.costUsd += c; this.ledger.calls += 1;
  }

  private readonly startedAt = new Date().toISOString();
  private flushed = { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 };

  /** Adds what this process spent since the last flush to the ledger on disk. Safe to call repeatedly. */
  flush() {
    mkdirSync(dirname(LEDGER), { recursive: true });
    const l = readLedger();
    l.inputTokens += this.run.inputTokens - this.flushed.inputTokens;
    l.outputTokens += this.run.outputTokens - this.flushed.outputTokens;
    l.costUsd += this.run.costUsd - this.flushed.costUsd;
    l.calls += this.run.calls - this.flushed.calls;
    l.runs = l.runs.filter((r) => r.at !== this.startedAt);
    l.runs.push({ at: this.startedAt, label: this.label, costUsd: this.run.costUsd, calls: this.run.calls });
    this.flushed = { ...this.run };
    writeFileSync(LEDGER, JSON.stringify(l, null, 2));
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    if (this.ledger.costUsd >= BUDGET_USD) throw new BudgetExceeded(`eval budget of $${BUDGET_USD} reached ($${this.ledger.costUsd.toFixed(4)} spent)`);
    let wait = 2000;
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if ((status === 429 || (status !== undefined && status >= 500)) && attempt < 5) {
          await new Promise((r) => setTimeout(r, wait + Math.random() * 500));
          wait *= 2;
          continue;
        }
        throw err;
      }
    }
  }

  async complete(system: string, user: string): Promise<LlmCompletion> {
    const r = await this.withRetry(() => this.inner.complete(system, user));
    this.account(r.inputTokens, r.outputTokens);
    return r;
  }

  async classify(system: string, user: string): Promise<string> {
    // The inner client drops usage on classify; estimate it (four characters a token) so it is not free.
    const r = await this.withRetry(() => this.inner.classify(system, user));
    this.account(Math.ceil((system.length + user.length) / 4) + 8, 10);
    return r;
  }

  async chat(input: { system: string; messages: ChatMessage[]; tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>; toolChoice?: "auto" | "none" }): Promise<ChatTurn> {
    const r = await this.withRetry(() => this.inner.chat(input));
    this.account(r.inputTokens, r.outputTokens);
    return r;
  }
}

/** Run `fn` over `items` with at most `n` in flight. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
