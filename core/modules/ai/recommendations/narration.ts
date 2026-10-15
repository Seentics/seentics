import { numbersIn } from '../insights/brief';
import { extractJson } from '../insights/output';
import { looksPersonal } from '../../../platform/heuristics';
import type { LlmClient } from '../interfaces/llm-client.interface';
import { ruleSentence } from './impact';
import type { Verdict } from './types';

/**
 * One sentence about an impact reading, worded by a cheap model when one is configured.
 *
 * The code has already decided what the reading means (`judge`); the model only says it more
 * naturally. Its sentence is kept only if every number in it is one the facts contained, it does
 * not claim cause, and it is a sensible length. Otherwise, or with no model, the rule sentence is
 * used. Either way the report's headline and caveats are the code's, never the model's.
 */

export type ImpactFacts = {
  headline: string;
  verdict: Verdict;
  /** Extra figures the model may quote (the automation's runs, the volumes). */
  extra: string[];
};

export interface ImpactNarrator {
  word(facts: ImpactFacts): Promise<{ sentence: string; source: 'ai' | 'rules' }>;
}

export const IMPACT_SYSTEM_PROMPT = `You report the measured result of a change someone made to their website, in ONE plain
sentence of at most 35 words, for the site owner.

Rules:
- Use only the numbers in the facts. Never add, round differently or estimate a figure.
- Never say the change caused the result: describe what happened after it, not because of it.
- If the verdict is no_change, say there is no clear change yet. If too_little_data, say there is
  too little traffic to tell. If improved or worse, say which way it moved.
- No greetings, no advice beyond one short clause.

Reply with JSON only: {"sentence": "..."}`;

const CAUSAL = /\b(because|caused|thanks to|due to|as a result|led to|resulted in)\b/i;
/** Whole numbers that carry no claim of their own. */
const FREE = new Set(['1', '2', '7', '14']);
const MIN_LEN = 20;
const MAX_LEN = 260;

/** Whether a model's sentence may be shown. Exported for tests. */
export function acceptSentence(sentence: string, facts: ImpactFacts): boolean {
  const s = sentence.trim();
  if (s.length < MIN_LEN || s.length > MAX_LEN) return false;
  if (CAUSAL.test(s) || looksPersonal(s)) return false;
  const allowed = numbersIn([facts.headline, ...facts.extra].join(' '));
  return [...numbersIn(s)].every((n) => allowed.has(n) || FREE.has(n));
}

export function createImpactNarrator(llm: LlmClient | null, onUsage?: (u: { inputTokens: number; outputTokens: number }) => void): ImpactNarrator {
  return {
    async word(facts) {
      const fallback = { sentence: ruleSentence(facts.headline, facts.verdict), source: 'rules' as const };
      // Nothing to word for a reading with no comparison: the rule sentence says all there is.
      if (!llm || facts.verdict === 'not_measurable' || facts.verdict === 'no_baseline') return fallback;
      try {
        const user = [
          `verdict: ${facts.verdict}`,
          `headline: ${facts.headline}`,
          ...facts.extra.map((e) => `fact: ${e}`),
        ].join('\n');
        const completion = await llm.complete(IMPACT_SYSTEM_PROMPT, user);
        onUsage?.({ inputTokens: completion.inputTokens, outputTokens: completion.outputTokens });
        const parsed = extractJson(completion.content) as { sentence?: unknown };
        const sentence = typeof parsed?.sentence === 'string' ? parsed.sentence.trim() : '';
        return acceptSentence(sentence, facts) ? { sentence, source: 'ai' } : fallback;
      } catch {
        return fallback;
      }
    },
  };
}
