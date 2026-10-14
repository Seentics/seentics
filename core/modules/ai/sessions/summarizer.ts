import { log as baseLog } from '../../../platform/observability/logger';
import type { SessionSummarizer, SessionSummaryInput, SessionSummaryResult } from '../../recordings/interfaces';
import type { LlmClient } from '../interfaces/llm-client.interface';
import type { ModelInfo } from '../insights/service';
import { buildSessionBrief } from './brief';
import { parseSessionSummary } from './output';
import { SESSION_SUMMARY_SYSTEM_PROMPT } from './prompts';
import { ruleSummary } from './rules';

const log = baseLog.child({ category: 'ai_session_summary' });

/**
 * Session summaries: `analysis -> brief -> model -> checked summary`, with the rule-based
 * summary whenever the model is missing, unreachable, or answers something that fails the
 * checks in output.ts.
 *
 * The recordings module decides when a summary is written and stores it; this only words
 * it. What a call cost is returned for that module to record, and logged here as the
 * insights are, so spend can be read from either the table or the logs.
 */
export class SessionSummaryService implements SessionSummarizer {
  constructor(private readonly deps: { llm: LlmClient | null; model: ModelInfo | null }) {}

  async summarize(input: SessionSummaryInput): Promise<SessionSummaryResult> {
    const rules = ruleSummary(input);
    const none = { model: null, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    const { llm, model } = this.deps;
    if (!llm || !model) return { summary: rules, source: 'rules', ...none };

    const brief = buildSessionBrief(input);
    let content: string;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const completion = await llm.complete(SESSION_SUMMARY_SYSTEM_PROMPT, brief.text);
      content = completion.content;
      inputTokens = completion.inputTokens;
      outputTokens = completion.outputTokens;
    } catch (err) {
      log.warn({ msg: 'ai_session_summary_model_failed', website_id: input.websiteId, session_id: input.sessionId, err: String(err) });
      return { summary: rules, source: 'rules', ...none };
    }

    const spent = {
      model: model.name,
      inputTokens,
      outputTokens,
      costUsd: inputTokens * model.inputCostPerToken + outputTokens * model.outputCostPerToken,
    };
    try {
      const { summary, dropped } = parseSessionSummary(content, brief, rules);
      log.info({
        msg: 'ai_session_summary_generated', website_id: input.websiteId, session_id: input.sessionId, model: model.name,
        input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: Number(spent.costUsd.toFixed(6)),
        moments: summary.moments.length, dropped: dropped.length,
      });
      return { summary, source: 'ai', ...spent };
    } catch (err) {
      log.warn({ msg: 'ai_session_summary_output_invalid', website_id: input.websiteId, session_id: input.sessionId, err: String(err) });
      // Paid for, so recorded with the model's name: a retry would most likely buy the same answer.
      return { summary: rules, source: 'rules', ...spent };
    }
  }
}
