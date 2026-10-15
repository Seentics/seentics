import { alertOps } from '../../../platform/observability/ops-alert';
import { log as baseLog } from '../../../platform/observability/logger';
import type {
  HeatmapInsightFinding,
  HeatmapInsightNarration,
  HeatmapInsightNarrator,
  HeatmapPageAnalysis,
} from '../../heatmaps/interfaces';
import type { LlmClient } from '../interfaces/llm-client.interface';
import type { ModelInfo } from '../insights/service';
import { MAX_BRIEF_SIGNALS, buildHeatmapBrief } from './brief';
import { parseHeatmapOutput, ruleHeatmapFindings, withRuleTopUp } from './output';
import { HEATMAP_INSIGHT_SYSTEM_PROMPT } from './prompts';
import type { HeatmapInsightRepository, StoredHeatmapInsight } from './repository';

const log = baseLog.child({ category: 'ai_heatmap_insights' });

/**
 * Words heatmap insights for the dashboard, on demand, and keeps the wording.
 *
 * Nothing runs on a schedule: a page is worded the first time its heatmap is opened, and the
 * stored wording is read on every later visit. Cost is bounded three ways:
 *
 * - stored wording is reused for `FRESH_MS`, unless the signals behind it changed (and even
 *   then not more often than `REFRESH_COOLDOWN_MS`);
 * - an explicit refresh is refused for `REFRESH_COOLDOWN_MS` after the last wording;
 * - a site may have at most `dailyCap` pages worded per UTC day; past it, the findings are
 *   worded from the rules (free) until the next day.
 *
 * Wording is checked line by line against the brief (output.ts). When the model is down, or
 * nothing it wrote passes, the findings come from the rules, so the panel always has
 * something true to say.
 */

/** Stored wording is reused this long. */
export const FRESH_MS = 24 * 60 * 60 * 1000;
/** A refresh, or rewording for changed signals, waits this long after the last wording. */
export const REFRESH_COOLDOWN_MS = 60 * 60 * 1000;
/** Wording that exists only because the model was down may be retried this soon. */
export const MODEL_RETRY_MS = 15 * 60 * 1000;
export const DEFAULT_DAILY_CAP = 60;

export const MODEL_UNREACHABLE_REASON = 'The AI model could not be reached; these findings are written from the data alone.';
export const OUTPUT_REJECTED_REASON = "The AI model's wording did not pass the checks; these findings are written from the data alone.";
export const DAILY_CAP_REASON = 'This site has reached its daily limit for AI-worded heatmap insights; these findings are written from the data alone.';

export type HeatmapNarratorDeps = {
  repo: HeatmapInsightRepository;
  /** `null`: no model is configured. */
  llm: LlmClient | null;
  model: ModelInfo | null;
  /** Pages per site per UTC day that may be worded by the model. */
  dailyCap?: number;
  now?: () => Date;
};

const signalKeyOf = (a: HeatmapPageAnalysis) =>
  a.signals.slice(0, MAX_BRIEF_SIGNALS).map((s) => s.id).sort().join(',');

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export class HeatmapInsightService implements HeatmapInsightNarrator {
  private readonly now: () => Date;
  private readonly dailyCap: number;
  /** One model call per page at a time: two tabs opening the same heatmap share it. */
  private readonly inFlight = new Map<string, Promise<HeatmapInsightNarration>>();

  constructor(private readonly deps: HeatmapNarratorDeps) {
    this.now = deps.now ?? (() => new Date());
    const cap = Math.trunc(deps.dailyCap ?? DEFAULT_DAILY_CAP);
    this.dailyCap = Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_CAP;
  }

  get configured(): boolean {
    return !!this.deps.llm && !!this.deps.model;
  }

  async narrate(websiteId: string, analysis: HeatmapPageAnalysis, opts: { refresh?: boolean } = {}): Promise<HeatmapInsightNarration> {
    const key = `${websiteId}|${analysis.page_path}|${analysis.device}|${analysis.days}|${opts.refresh ? 'r' : ''}`;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const run = this.narrateOnce(websiteId, analysis, !!opts.refresh).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, run);
    return run;
  }

  private async narrateOnce(websiteId: string, analysis: HeatmapPageAnalysis, refresh: boolean): Promise<HeatmapInsightNarration> {
    const now = this.now();
    if (!analysis.sufficient || !analysis.signals.length) {
      return { source: 'rules', findings: [], generated_at: now.toISOString(), reason: analysis.reason, retry_after_sec: null };
    }
    // One finding is said as well by its template as by a model: the model only for several to rank and connect.
    if (!this.configured || analysis.signals.length < 2) return this.rulesNow(analysis, now, null);

    const key = { websiteId, pagePath: analysis.page_path, device: analysis.device, days: analysis.days };
    const signalKey = signalKeyOf(analysis);
    const existing = await this.deps.repo.get(key);
    if (existing) {
      const age = now.getTime() - new Date(existing.createdAt).getTime();
      const modelWasDown = existing.reason === MODEL_UNREACHABLE_REASON;
      const cooldown = modelWasDown ? MODEL_RETRY_MS : REFRESH_COOLDOWN_MS;
      const coolingDown = age < cooldown;
      const retryAfter = coolingDown ? Math.ceil((cooldown - age) / 1000) : null;
      if (refresh) {
        if (coolingDown) return present(existing, retryAfter);
      } else {
        const stale = age >= FRESH_MS || (existing.signalKey !== signalKey && !coolingDown) || (modelWasDown && !coolingDown);
        if (!stale) return present(existing, retryAfter);
      }
    }

    const since = startOfUtcDay(now);
    if ((await this.deps.repo.countSince(websiteId, since)) >= this.dailyCap) {
      void alertOps("A site reached its daily AI heatmap insight limit", { website_id: websiteId, limit: this.dailyCap });
      // Kept as it was when there is something stored; otherwise the rules, unsaved.
      if (existing) return present(existing, Math.ceil((since.getTime() + 86_400_000 - now.getTime()) / 1000));
      return this.rulesNow(analysis, now, DAILY_CAP_REASON);
    }

    const stored = await this.generate(key, analysis, signalKey, now);
    await this.deps.repo.save(stored);
    return present(stored, Math.ceil(REFRESH_COOLDOWN_MS / 1000));
  }

  private rulesNow(analysis: HeatmapPageAnalysis, now: Date, reason: string | null): HeatmapInsightNarration {
    return { source: 'rules', findings: ruleHeatmapFindings(analysis.signals), generated_at: now.toISOString(), reason, retry_after_sec: null };
  }

  private async generate(
    key: { websiteId: string; pagePath: string; device: HeatmapPageAnalysis['device']; days: number },
    analysis: HeatmapPageAnalysis,
    signalKey: string,
    now: Date,
  ): Promise<StoredHeatmapInsight & { signals: unknown[] }> {
    const signals = analysis.signals.slice(0, MAX_BRIEF_SIGNALS);
    const base = {
      ...key,
      signalKey,
      signals: signals.map((s) => ({ id: s.id, kind: s.kind, device: s.device, facts: s.facts })),
      createdAt: now.toISOString(),
    };
    const rules = (reason: string, spent: Partial<StoredHeatmapInsight> = {}) => ({
      ...base, model: null, inputTokens: 0, outputTokens: 0, costUsd: 0, ...spent,
      source: 'rules' as const, findings: ruleHeatmapFindings(signals), reason,
    });

    const llm = this.deps.llm!;
    const model = this.deps.model!;
    const brief = buildHeatmapBrief(analysis);
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      ({ content, inputTokens, outputTokens } = await llm.complete(HEATMAP_INSIGHT_SYSTEM_PROMPT, brief.text));
    } catch (err) {
      log.warn({ msg: 'ai_heatmap_insight_model_failed', website_id: key.websiteId, err: String(err) });
      return rules(MODEL_UNREACHABLE_REASON);
    }

    const spent = {
      model: model.name,
      inputTokens,
      outputTokens,
      costUsd: inputTokens * model.inputCostPerToken + outputTokens * model.outputCostPerToken,
    };
    let findings: HeatmapInsightFinding[] = [];
    let dropped: Array<{ signal: string; why: string }> = [];
    try {
      ({ findings, dropped } = parseHeatmapOutput(content, signals, brief.numbers));
    } catch (err) {
      log.warn({ msg: 'ai_heatmap_insight_output_invalid', website_id: key.websiteId, err: String(err) });
    }
    log.info({
      msg: 'ai_heatmap_insight_generated', website_id: key.websiteId, model: model.name,
      input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: Number(spent.costUsd.toFixed(6)),
      signals: signals.length, findings: findings.length, dropped: dropped.length,
    });
    if (!findings.length) return rules(OUTPUT_REJECTED_REASON, spent);
    return { ...base, ...spent, source: 'ai', findings: withRuleTopUp(findings, signals), reason: null };
  }
}

function present(s: StoredHeatmapInsight, retryAfterSec: number | null): HeatmapInsightNarration {
  return {
    source: s.source,
    findings: s.findings,
    generated_at: s.createdAt,
    reason: s.reason,
    retry_after_sec: retryAfterSec && retryAfterSec > 0 ? retryAfterSec : null,
  };
}
