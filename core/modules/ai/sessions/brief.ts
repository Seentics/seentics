import type { SessionSummaryInput } from '../../recordings/interfaces';
import { numbersIn } from '../insights/brief';
import { clock, maskPath, maskText, span } from '../../../platform/heuristics';

export { clock, span };

/**
 * The compact brief a session summary is written from: a few dozen short lines.
 *
 * Built from the stored analysis, never the recording, so it holds what the detector
 * already reduced a session to — masked routes, short masked element labels, error
 * messages, timings. No typed values exist anywhere upstream of this. Every page, label and
 * message is masked again here anyway: the brief is the last thing before a third party.
 *
 * Every timestamp printed is registered in `times`, which is how output.ts knows a
 * "notable moment" the model returns is one that happened, and every figure is in
 * `numbers`, so a summary quoting one the data did not give is rejected.
 */

const MAX_CHARS = 6000;
const MAX_PAGES = 20;
const MAX_CLICKS = 25;
const MAX_SIGNALS = 15;
const MAX_ERRORS = 5;

export type SessionBrief = {
  text: string;
  numbers: Set<string>;
  /** `m:ss` as printed in the brief, to the playback offset it stands for. */
  times: Map<string, number>;
};



const label = (l: string | undefined) => maskText(l ?? '', 70);

export function buildSessionBrief(input: SessionSummaryInput): SessionBrief {
  const times = new Map<string, number>();
  const at = (ms: number) => {
    const c = clock(ms);
    if (!times.has(c)) times.set(c, ms);
    return `[${c}]`;
  };
  const t = input.timeline;
  const lines: string[] = [];

  const env = [input.device, input.browser, input.os].map((v) => maskText(v, 30)).filter((v) => v && v !== 'Unknown');
  lines.push(`session: ${span(t.durationMs)} recorded${env.length ? ` · ${env.join(' · ')}` : ''}${input.country ? ` · country ${maskText(input.country, 8)}` : ''}`);
  lines.push(`frustration score: ${input.score} of 100`);
  const counts = Object.entries(input.counts).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${k} ${n}`);
  lines.push(`signal counts: ${counts.length ? counts.join(', ') : 'none'}`);

  lines.push('', 'pages in order ([start] route (time on page)):');
  if (!t.pages.length) lines.push('(no page changes recorded)');
  for (const p of t.pages.slice(0, MAX_PAGES)) lines.push(`${at(p.atMs)} ${maskPath(p.path)} (${span(p.dwellMs)})`);
  if (t.pages.length > MAX_PAGES) lines.push(`(${t.pages.length - MAX_PAGES} more pages not listed)`);

  lines.push('', 'clicks ([time] page: element):');
  if (!t.clicks.length) lines.push('(none)');
  for (const c of t.clicks.slice(0, MAX_CLICKS)) lines.push(`${at(c.atMs)} ${maskPath(c.page)}: ${label(c.label)}`);

  lines.push('', 'frustration signals ([time] type on page: element, detail):');
  if (!input.signals.length) lines.push('(none)');
  for (const s of input.signals.slice(0, MAX_SIGNALS)) {
    const parts = [`${at(s.atMs)} ${s.type} on ${maskPath(s.page)}`];
    if (s.label) parts.push(`: ${label(s.label)}`);
    if (s.count && s.count > 1) parts.push(` x${s.count}`);
    if (s.detail) parts.push(` (${maskText(s.detail, 80)})`);
    lines.push(parts.join(''));
  }

  lines.push('', `javascript errors (${t.errorCount} in total; distinct messages):`);
  if (!t.errors.length) lines.push('(none)');
  for (const e of t.errors.slice(0, MAX_ERRORS)) lines.push(`${at(e.atMs)} on ${maskPath(e.page)}: ${maskText(e.message, 120)}`);

  lines.push('');
  lines.push(`form fields typed into: ${t.fieldsTouched}`);
  lines.push(`failed requests: ${t.failedRequests}`);
  lines.push(t.goal.reached && t.goal.page != null
    ? `goal-like page reached: yes, ${maskPath(t.goal.page)}${t.goal.atMs != null ? ` at ${at(t.goal.atMs)}` : ''}`
    : 'goal-like page reached: no (none of the routes looks like a confirmation or thank-you page)');
  if (t.truncated) lines.push('note: the recording was too long to read in full; this covers its start');

  let text = lines.join('\n');
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
  // A timestamp cut off with the tail of the brief is not one the model saw.
  for (const key of [...times.keys()]) if (!text.includes(`[${key}]`)) times.delete(key);
  return { text, numbers: numbersIn(text), times };
}
