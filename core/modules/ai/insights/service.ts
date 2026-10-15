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

/**
 * The reason stored when the model could not be reached. It also marks the row as retryable: the
 * lines are the template ones, nothing was spent, and a later run or refresh should try the model
 * again rather than keep these for the rest of the day. (Kept in `reason` so no migration is needed.)
 */
export const MODEL_UNREACHABLE_REASON = 'The model could not be reached; these lines are written from the data alone.';
/** A row that only exists because the model was down may be regenerated this soon by a refresh. */
export const MODEL_RETRY_MS = 15 * 60 * 1000;
/** After this many model failures in a row, a daily run stops calling the model until it ends. */
export const MODEL_BREAKER_THRESHOLD = 5;

/** Whether a stored insight was written from templates only because the model failed, so it should be retried. */
export const isModelFailure = (i: Pick<StoredInsight, 'status' | 'source' | 'reason'>): boolean =>
  i.status === 'ready' && i.source === 'rules' && i.reason === MODEL_UNREACHABLE_REASON;

export type ModelInfo = { name: string; inputCostPerToken: number; outputCostPerToken: number };

export type InsightDeps = {
  snapshot: (websiteId: string, days: number) => Promise<InsightSnapshot>;
  repo: InsightRepository;
  /** `null`: no model is configured, so lines are worded from templates. */
  llm: LlmClient | null;
  model: ModelInfo | null;
  now?: () => Date;
};

export type GenerateResult = {
  insight: StoredInsight;
  generated: boolean;
  retryAfterMs?: number;
  /** The model was called and failed (or was skipped by the run's breaker) for this insight. */
  modelFailed?: boolean;
};
type GenerateOpts = { force?: boolean; /** Do not call the model: the run's breaker is open. */ skipModel?: boolean };
export type RunStats = { generated: number; skipped: number; failed: number; tokens: number; costUsd: number };

const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export class InsightService {
  private readonly now: () => Date;
  /** Sites whose insight is being made now: two dashboards opening at once share one model call. */
  private readonly making = new Map<string, Promise<StoredInsight | null>>();

  constructor(private readonly deps: InsightDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** What the dashboard shows: the newest insight, read from storage. Never calls a model. */
  latest(websiteId: string): Promise<StoredInsight | null> {
    return this.deps.repo.latest(websiteId);
  }

  /**
   * What the dashboard shows, made on the first read of the day: the model is called only for sites
   * someone looks at. Falls back to the newest stored one when today's cannot be made.
   */
  async today(websiteId: string): Promise<StoredInsight | null> {
    const latest = await this.deps.repo.latest(websiteId);
    if (latest?.insightDate === dayOf(this.now())) return latest;
    let making = this.making.get(websiteId);
    if (!making) {
      making = this.generate(websiteId)
        .then((r) => r.insight, (err: unknown) => {
          log.warn({ msg: 'ai_insight_on_read_failed', website_id: websiteId, err: String(err) });
          return latest;
        })
        .finally(() => this.making.delete(websiteId));
      this.making.set(websiteId, making);
    }
    return making;
  }

  /** Today's insight worded from templates, not stored and never a model call: for the weekly digest. */
  async draft(websiteId: string): Promise<StoredInsight> {
    const now = this.now();
    const snapshot = await this.deps.snapshot(websiteId, INSIGHT_DAYS);
    const { signals: _signals, modelFailed: _failed, ...insight } = await this.build(snapshot, dayOf(now), now, false, true);
    return insight;
  }

  /**
   * Make today's insight for a site, unless it already exists. `force` asks for a fresh one, which
   * is allowed once every `MIN_REFRESH_MS`: the result then says how long until it can be asked again.
   */
  async generate(websiteId: string, opts: { force?: boolean } = {}): Promise<GenerateResult> {
    return this.generateWith(websiteId, opts);
  }

  private async generateWith(websiteId: string, opts: GenerateOpts): Promise<GenerateResult> {
    const now = this.now();
    const today = dayOf(now);
    const existing = await this.deps.repo.get(websiteId, today);
    if (existing && existing.status !== 'failed') {
      // Written from templates only because the model was down: worth another try when a model is
      // configured, unless this run already gave up on the model.
      const retryable = isModelFailure(existing) && !!this.deps.llm && !!this.deps.model;
      const age = now.getTime() - new Date(existing.createdAt).getTime();
      if (retryable) {
        if (opts.skipModel) return { insight: existing, generated: false };
        // Nothing was spent on it, but a refresh still reads the analytics: a short floor, not the six hours.
        if (opts.force && age < MODEL_RETRY_MS) return { insight: existing, generated: false, retryAfterMs: MODEL_RETRY_MS - age };
      } else {
        if (!opts.force) return { insight: existing, generated: false };
        if (age < MIN_REFRESH_MS) return { insight: existing, generated: false, retryAfterMs: MIN_REFRESH_MS - age };
      }
    }

    const snapshot = await this.deps.snapshot(websiteId, INSIGHT_DAYS);
    const { modelFailed, ...insight } = await this.build(snapshot, today, now, !!opts.skipModel);
    await this.deps.repo.save(insight);
    return { insight, generated: true, modelFailed };
  }

  /**
   * Every site in `websiteIds`, a few at a time. A site that fails does not stop the others.
   *
   * A breaker: after `MODEL_BREAKER_THRESHOLD` model failures in a row, the rest of the run writes
   * template lines without calling the model. Those rows are marked retryable, so the next run
   * (or a refresh) tries again once the provider is back.
   */
  async runDaily(websiteIds: readonly string[], concurrency = 2): Promise<RunStats> {
    const stats: RunStats = { generated: 0, skipped: 0, failed: 0, tokens: 0, costUsd: 0 };
    let next = 0;
    let consecutiveModelFailures = 0;
    let breakerOpen = false;
    const worker = async () => {
      while (next < websiteIds.length) {
        const id = websiteIds[next++]!;
        try {
          const { insight, generated, modelFailed } = await this.generateWith(id, { skipModel: breakerOpen });
          // The model answered (whether or not its wording passed): the provider is up.
          if (!breakerOpen && generated && !modelFailed && insight.model !== null) consecutiveModelFailures = 0;
          if (!breakerOpen && modelFailed) {
            consecutiveModelFailures += 1;
            if (consecutiveModelFailures >= MODEL_BREAKER_THRESHOLD) {
              breakerOpen = true;
              log.error({ msg: 'ai_insight_model_breaker_open', failures: consecutiveModelFailures, remaining: websiteIds.length - next });
            }
          }
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

  private async build(snapshot: InsightSnapshot, date: string, now: Date, skipModel = false, noModel = false): Promise<StoredInsight & { signals: Signal[]; modelFailed?: boolean }> {
    const base = {
      websiteId: snapshot.websiteId,
      insightDate: date,
      createdAt: now.toISOString(),
      model: null as string | null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };

    // Gated on the busier of the two windows: a site whose traffic collapsed this week has a
    // story (often broken tracking), not "not enough data".
    const visitors = snapshot.traffic.visitors.cur;
    if (Math.max(visitors, snapshot.traffic.visitors.prev) < THRESHOLDS.minVisitors) {
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
    if (!this.deps.llm || !this.deps.model || noModel) return rules(null);
    if (skipModel) return { ...rules(MODEL_UNREACHABLE_REASON), modelFailed: true };

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
      return { ...rules(MODEL_UNREACHABLE_REASON), modelFailed: true };
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
