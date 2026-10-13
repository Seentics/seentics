import { log as baseLog } from '../../../platform/observability/logger';
import type { LlmClient } from '../interfaces/llm-client.interface';
import { buildBrief } from './brief';
import { parseModelOutput, ruleLines } from './output';
import { INSIGHT_SYSTEM_PROMPT } from './prompts';
import type { InsightRepository } from './repository';
import { THRESHOLDS, detectSignals } from './signals';
import type { InsightLine, InsightSnapshot, Signal, StoredInsight } from './types';

const log = baseLog.child({ category: 'ai_insights' });

/** The window each insight looks at, and the one before it. */
export const INSIGHT_DAYS = 7;
/** A manual refresh is refused for this long after the last generation: never a way to run up the bill. */
export const MIN_REFRESH_MS = 6 * 60 * 60 * 1000;

export type ModelInfo = { name: string; inputCostPerToken: number; outputCostPerToken: number };

export type InsightDeps = {
  snapshot: (websiteId: string, days: number) => Promise<InsightSnapshot>;
  repo: InsightRepository;
  /** `null`: no model is configured, so lines are worded from templates. */
  llm: LlmClient | null;
  model: ModelInfo | null;
  now?: () => Date;
};

export type GenerateResult = { insight: StoredInsight; generated: boolean; retryAfterMs?: number };
export type RunStats = { generated: number; skipped: number; failed: number; tokens: number; costUsd: number };

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export class InsightService {
  private readonly now: () => Date;

  constructor(private readonly deps: InsightDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** What the dashboard shows: the newest insight, read from storage. Never calls a model. */
  latest(websiteId: string): Promise<StoredInsight | null> {
    return this.deps.repo.latest(websiteId);
  }

  /**
   * Make today's insight for a site, unless it already exists. `force` asks for a fresh one, which
   * is allowed once every `MIN_REFRESH_MS`: the result then says how long until it can be asked again.
   */
  async generate(websiteId: string, opts: { force?: boolean } = {}): Promise<GenerateResult> {
    const now = this.now();
    const today = dayOf(now);
    const existing = await this.deps.repo.get(websiteId, today);
    if (existing && existing.status !== 'failed') {
      if (!opts.force) return { insight: existing, generated: false };
      const age = now.getTime() - new Date(existing.createdAt).getTime();
      if (age < MIN_REFRESH_MS) return { insight: existing, generated: false, retryAfterMs: MIN_REFRESH_MS - age };
    }

    const snapshot = await this.deps.snapshot(websiteId, INSIGHT_DAYS);
    const insight = await this.build(snapshot, today, now);
    await this.deps.repo.save(insight);
    return { insight, generated: true };
  }

  /** Every site in `websiteIds`, a few at a time. A site that fails does not stop the others. */
  async runDaily(websiteIds: readonly string[], concurrency = 2): Promise<RunStats> {
    const stats: RunStats = { generated: 0, skipped: 0, failed: 0, tokens: 0, costUsd: 0 };
    let next = 0;
    const worker = async () => {
      while (next < websiteIds.length) {
        const id = websiteIds[next++]!;
        try {
          const { insight, generated } = await this.generate(id);
          if (!generated) { stats.skipped += 1; continue; }
          stats.generated += 1;
          stats.tokens += insight.inputTokens + insight.outputTokens;
          stats.costUsd += insight.costUsd;
        } catch (err) {
          stats.failed += 1;
          log.error({ msg: 'ai_insight_failed', website_id: id, err: String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, websiteIds.length)) }, worker));
    return stats;
  }

  private async build(snapshot: InsightSnapshot, date: string, now: Date): Promise<StoredInsight & { signals: Signal[] }> {
    const base = {
      websiteId: snapshot.websiteId,
      insightDate: date,
      createdAt: now.toISOString(),
      model: null as string | null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };

    const visitors = snapshot.traffic.visitors.cur;
    if (visitors < THRESHOLDS.minVisitors) {
      return {
        ...base, status: 'insufficient_data', source: 'rules', lines: [], signals: [],
        reason: `Only ${visitors.toLocaleString('en-US')} visitors in the last ${snapshot.days} days. Insights start at about ${THRESHOLDS.minVisitors}.`,
      };
    }

    const signals = detectSignals(snapshot);
    if (!signals.length) {
      return { ...base, status: 'ready', source: 'rules', lines: [], signals: [], reason: 'Nothing changed enough this week to report.' };
    }

    const rules = (reason: string | null, extra: Partial<typeof base> = {}) => ({
      ...base, ...extra, status: 'ready' as const, source: 'rules' as const, lines: ruleLines(signals), signals, reason,
    });
    if (!this.deps.llm || !this.deps.model) return rules(null);

    const brief = buildBrief(snapshot, signals);
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const completion = await this.deps.llm.complete(INSIGHT_SYSTEM_PROMPT, brief.text);
      content = completion.content;
      inputTokens = completion.inputTokens;
      outputTokens = completion.outputTokens;
    } catch (err) {
      log.warn({ msg: 'ai_insight_model_failed', website_id: snapshot.websiteId, err: String(err) });
      return rules('The model could not be reached; these lines are written from the data alone.');
    }

    const model = this.deps.model;
    const spent = {
      model: model.name,
      inputTokens,
      outputTokens,
      costUsd: inputTokens * model.inputCostPerToken + outputTokens * model.outputCostPerToken,
    };

    let lines: InsightLine[] = [];
    let dropped: Array<{ signal: string; why: string }> = [];
    try {
      ({ lines, dropped } = parseModelOutput(content, signals, brief.numbers));
    } catch (err) {
      log.warn({ msg: 'ai_insight_output_invalid', website_id: snapshot.websiteId, err: String(err) });
    }
    log.info({
      msg: 'ai_insight_generated', website_id: snapshot.websiteId, model: model.name,
      input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: Number(spent.costUsd.toFixed(6)),
      signals: signals.length, lines: lines.length, dropped: dropped.length,
    });
    if (!lines.length) return rules('The model\'s wording did not pass the checks; these lines are written from the data alone.', spent);
    return { ...base, ...spent, status: 'ready', source: 'ai', lines, signals, reason: null };
  }
}
