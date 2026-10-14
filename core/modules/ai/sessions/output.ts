import { z } from 'zod';
import type { SessionSummary } from '../../recordings/interfaces';
import { numbersIn } from '../insights/brief';
import { extractJson } from '../insights/output';
import { looksPersonal } from '../insights/privacy';
import type { SessionBrief } from './brief';

/**
 * What the model may return for a session, and what is kept.
 *
 * Strict where being wrong would mislead, lenient where it would only cost polish:
 *
 *   - The summary text is required. It is refused outright — and the caller falls back to
 *     the rule-based summary — when it states a number the brief does not contain or reads
 *     like personal data. A shorter or reworded summary is not a reason to refuse.
 *   - The intent and outcome are optional: a missing or unrecognised one is replaced by
 *     the rules' reading of the same evidence rather than failing the whole answer.
 *   - Each moment is checked on its own. Its timestamp must be one printed in the brief,
 *     so the player can only be sent to a moment that happened; a moment that fails is
 *     dropped, not repaired.
 */

const envelope = z.object({
  summary: z.string(),
  intent: z.unknown().optional(),
  outcome: z.unknown().optional(),
  moments: z.array(z.unknown()).optional(),
});

const momentShape = z.object({
  at: z.union([z.string(), z.number()]).transform((v) => String(v).trim().replace(/^\[|\]$/g, '')),
  label: z.string().trim().min(3),
});

export const MAX_SUMMARY = 600;
export const MAX_INTENT = 120;
export const MAX_MOMENT_LABEL = 100;
export const MAX_MOMENTS = 3;
/** Small whole numbers that carry no claim of their own ("two pages", "3 times"). */
const FREE_NUMBERS = new Set(['0', '1', '2', '3']);

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

function invented(text: string, brief: SessionBrief): string[] {
  return [...numbersIn(text)].filter((n) => !brief.numbers.has(n) && !FREE_NUMBERS.has(n));
}

/** `01:05` and `1:05` are the same moment; the brief prints the second. */
function normaliseClock(at: string): string {
  const parts = at.split(':');
  if (parts.length < 2 || parts.some((p) => !/^\d+$/.test(p))) return at;
  return [String(Number(parts[0])), ...parts.slice(1)].join(':');
}

export function normaliseOutcome(v: unknown): SessionSummary['outcome'] | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (/^(succeeded|success|successful|completed?|converted)$/.test(s)) return 'succeeded';
  if (/^(struggled|struggling|frustrated|partial(ly)?)$/.test(s)) return 'struggled';
  if (/^(abandoned|abandon|gave up|left|bounced|failed)$/.test(s)) return 'abandoned';
  return null;
}

export type ParsedSummary = { summary: SessionSummary; dropped: string[] };

/**
 * Parse and check a model answer. Throws when the summary itself cannot be used; the
 * caller then serves `fallback` instead.
 */
export function parseSessionSummary(
  raw: string,
  brief: SessionBrief,
  fallback: Pick<SessionSummary, 'intent' | 'outcome'>,
): ParsedSummary {
  const parsed = envelope.parse(extractJson(raw));
  const dropped: string[] = [];

  const text = clip(parsed.summary, MAX_SUMMARY);
  if (text.length < 20) throw new Error('summary too short');
  if (looksPersonal(text)) throw new Error('summary looks like personal data');
  const bad = invented(text, brief);
  if (bad.length) throw new Error(`summary states numbers not in the brief: ${bad.join(', ')}`);

  let intent = typeof parsed.intent === 'string' ? clip(parsed.intent, MAX_INTENT) : '';
  if (!intent || looksPersonal(intent) || invented(intent, brief).length) {
    if (intent) dropped.push('intent');
    intent = fallback.intent;
  }

  const outcome = normaliseOutcome(parsed.outcome);
  if (!outcome) dropped.push('outcome');

  const moments: SessionSummary['moments'] = [];
  const usedAt = new Set<number>();
  for (const item of (parsed.moments ?? []).slice(0, 6)) {
    const m = momentShape.safeParse(item);
    if (!m.success) { dropped.push('malformed moment'); continue; }
    const atMs = brief.times.get(normaliseClock(m.data.at));
    if (atMs === undefined) { dropped.push(`moment at ${m.data.at.slice(0, 12)} not in the brief`); continue; }
    if (usedAt.has(atMs)) { dropped.push('moment repeated'); continue; }
    const label = clip(m.data.label, MAX_MOMENT_LABEL);
    if (looksPersonal(label) || invented(label, brief).length) { dropped.push('moment label rejected'); continue; }
    usedAt.add(atMs);
    moments.push({ atMs, label });
    if (moments.length === MAX_MOMENTS) break;
  }
  moments.sort((a, b) => a.atMs - b.atMs);

  return { summary: { text, intent, outcome: outcome ?? fallback.outcome, moments }, dropped };
}
