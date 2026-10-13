import { z } from 'zod';
import { numbersIn } from './brief';
import { looksPersonal } from './privacy';
import type { InsightLine, Signal } from './types';

/**
 * What the model may return, and what is done with it.
 *
 * It returns, for each line, which signal the line is about and the wording. The evidence
 * link and the action behind a line come from that signal, never from the model, so it
 * cannot point an owner at a page that does not exist or propose something the product
 * cannot do. A line is kept only when:
 *
 *   - it names a signal that was in the brief,
 *   - every number in it appears in the brief (a figure the data did not give is invented),
 *   - it contains nothing that looks like personal data, and
 *   - it is a sensible length.
 *
 * A line that fails any of these is dropped, not repaired. Fewer lines is the right answer
 * to a model that wandered.
 */

const modelOutput = z.object({
  lines: z
    .array(
      z.object({
        signal: z.string().min(1).max(120),
        kind: z.enum(['finding', 'action']).default('finding'),
        text: z.string().min(12).max(300),
      }),
    )
    .max(6),
});

export const MAX_LINES = 3;

export type ParsedLines = { lines: InsightLine[]; dropped: Array<{ signal: string; why: string }> };

/** The first JSON object in `raw`, tolerating a code fence or a sentence around it. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in the model output');
  return JSON.parse(body.slice(start, end + 1));
}

/** Small whole numbers that carry no claim of their own ("2×", "top 3", "last 7 days"). */
const FREE_NUMBERS = new Set(['1', '2', '3', '7']);

export function parseModelOutput(raw: string, signals: Signal[], briefNumbers: Set<string>): ParsedLines {
  const parsed = modelOutput.parse(extractJson(raw));
  const byId = new Map(signals.map((s) => [s.id, s]));
  const lines: InsightLine[] = [];
  const dropped: ParsedLines['dropped'] = [];
  const used = new Set<string>();

  for (const line of parsed.lines) {
    const signal = byId.get(line.signal);
    const drop = (why: string) => dropped.push({ signal: line.signal, why });
    if (!signal) { drop('unknown signal'); continue; }
    if (used.has(signal.id)) { drop('signal used twice'); continue; }
    if (looksPersonal(line.text)) { drop('looks like personal data'); continue; }
    const invented = [...numbersIn(line.text)].filter((n) => !briefNumbers.has(n) && !FREE_NUMBERS.has(n));
    if (invented.length) { drop(`numbers not in the data: ${invented.join(', ')}`); continue; }

    const wantsAction = line.kind === 'action' && !!signal.action;
    lines.push({
      kind: wantsAction ? 'action' : 'finding',
      text: line.text.trim(),
      evidence: signal.evidence,
      action: wantsAction ? signal.action : undefined,
    });
    used.add(signal.id);
    if (lines.length === MAX_LINES) break;
  }
  return { lines, dropped };
}

/** The lines worded from templates, for a site with no model or when the model's output failed the checks. */
export function ruleLines(signals: Signal[]): InsightLine[] {
  const lines: InsightLine[] = [];
  const findings = signals.slice(0, MAX_LINES);
  const actionable = signals.find((s) => s.action);
  for (const s of findings) {
    lines.push({ kind: 'finding', text: s.text, evidence: s.evidence });
  }
  // The last line is a suggestion when there is one to make, replacing the least important finding.
  if (actionable && actionable.action) {
    const suggestion: InsightLine = {
      kind: 'action',
      text: `${actionable.action.title}: ${actionable.text}`,
      evidence: actionable.evidence,
      action: actionable.action,
    };
    if (lines.length >= MAX_LINES) lines[MAX_LINES - 1] = suggestion;
    else lines.push(suggestion);
  }
  return lines.slice(0, MAX_LINES);
}
