import type { FrustrationSignal, SessionSummary, SessionSummaryInput } from '../../recordings/interfaces';
import { span } from './brief';
import { maskPath, maskText } from '../insights/privacy';

/**
 * A summary written from the analysis alone, for when no model answered usefully.
 *
 * Plain and factual: the pages, the worst signals, the errors, and an outcome read from
 * the same evidence the model would have had. Every phrase comes from stored fields, so it
 * can never say something the data does not.
 */

const PHRASE: Record<FrustrationSignal['type'], string> = {
  rage_click: 'rage-clicked',
  error_click: 'hit an error after clicking',
  form_abandon: 'filled in a form without submitting it on',
  dead_click: 'clicked something that did not respond:',
  u_turn: 'left and came straight back from',
  scroll_thrash: 'scrolled back and forth on',
};

function describe(s: FrustrationSignal): string {
  const target = s.label ? ` ${maskText(s.label, 60)}` : '';
  const page = maskPath(s.page);
  switch (s.type) {
    case 'rage_click':
    case 'error_click':
    case 'dead_click':
      return `${PHRASE[s.type]}${target} on ${page}`;
    default:
      return `${PHRASE[s.type]} ${page}`;
  }
}

/** Worst first, then earliest: the order the moments and the sentence list them in. */
const SEVERITY: FrustrationSignal['type'][] = ['error_click', 'rage_click', 'form_abandon', 'dead_click', 'u_turn', 'scroll_thrash'];

export function ruleOutcome(input: SessionSummaryInput): SessionSummary['outcome'] {
  const t = input.timeline;
  if (t.goal.reached) return input.score >= 40 ? 'struggled' : 'succeeded';
  if ((input.counts.form_abandon ?? 0) > 0) return 'abandoned';
  if (input.score >= 30) return 'struggled';
  if (t.pages.length <= 1 && t.durationMs < 30_000) return 'abandoned';
  return 'succeeded';
}

export function ruleSummary(input: SessionSummaryInput): SessionSummary {
  const t = input.timeline;
  const pages = t.pages.map((p) => maskPath(p.path));
  const first = pages[0];
  const last = pages[pages.length - 1];
  const sentences: string[] = [];

  const pageCount = new Set(pages).size;
  sentences.push(
    first
      ? `The visitor spent ${span(t.durationMs)} on ${pageCount} page${pageCount === 1 ? '' : 's'}, starting on ${first}${last && last !== first ? ` and ending on ${last}` : ''}.`
      : `The visitor was recorded for ${span(t.durationMs)}.`,
  );

  const ordered = [...input.signals].sort((a, b) => SEVERITY.indexOf(a.type) - SEVERITY.indexOf(b.type) || a.atMs - b.atMs);
  const worst = ordered.slice(0, 2).map(describe);
  if (worst.length) sentences.push(`They ${worst.join(', and ')}.`);
  if (t.errorCount > 0) sentences.push(`${t.errorCount} JavaScript error${t.errorCount === 1 ? ' was' : 's were'} recorded.`);
  if (t.goal.reached && t.goal.page) sentences.push(`They reached ${maskPath(t.goal.page)}.`);
  else if (!input.signals.length && t.errorCount === 0) sentences.push('Nothing in the recording suggests they ran into problems.');

  const longest = [...t.pages].sort((a, b) => b.dwellMs - a.dwellMs)[0];
  const intent = t.goal.reached && t.goal.page
    ? `Reach ${maskPath(t.goal.page)}`
    : longest
      ? `Unclear; most time was spent on ${maskPath(longest.path)}`
      : 'Unclear from the recording';

  return {
    text: sentences.slice(0, 4).join(' '),
    intent,
    outcome: ruleOutcome(input),
    moments: ordered.slice(0, 3).map((s) => ({ atMs: s.atMs, label: describe(s).replace(/^./, (c) => c.toUpperCase()).slice(0, 100) })),
  };
}
