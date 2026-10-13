import type { InsightSnapshot, Signal } from './types';

/**
 * The compact brief the model reads: a few dozen short lines, not the data.
 *
 * Every figure the model may quote is in here, already worked out. That is what lets
 * output.ts check a line's numbers against it: a number that is not in the brief did not
 * come from the data, and the line is dropped. Keeping the brief small keeps the call
 * cheap (about 1-2K tokens in practice, far under the 8.5K budget) and the static
 * instructions in front of it cacheable.
 */

const MAX_CHARS = 8000;

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const pctChange = (cur: number, prev: number) => (prev > 0 ? `${cur >= prev ? '+' : '-'}${Math.round((Math.abs(cur - prev) / prev) * 100)}%` : 'n/a');

export type Brief = { text: string; numbers: Set<string> };

export function buildBrief(s: InsightSnapshot, signals: Signal[]): Brief {
  const t = s.traffic;
  const lines: string[] = [];
  lines.push(`period: last ${s.days}d vs the ${s.days}d before`);
  lines.push(
    `traffic: visitors ${num(t.visitors.cur)} (${pctChange(t.visitors.cur, t.visitors.prev)}), pageviews ${num(t.pageviews.cur)} (${pctChange(t.pageviews.cur, t.pageviews.prev)}), ` +
    `sessions ${num(t.sessions.cur)} (${pctChange(t.sessions.cur, t.sessions.prev)}), bounce ${Math.round(t.bounceRate.cur)}% (prev ${Math.round(t.bounceRate.prev)}%), avg visit ${num(t.avgSessionSec.cur)}s (prev ${num(t.avgSessionSec.prev)}s)`,
  );

  lines.push('', 'signals, most important first (cite by id):');
  if (!signals.length) lines.push('(none: nothing changed enough to report)');
  for (const sig of signals) lines.push(`[${sig.id}] ${sig.brief}${sig.action ? ' | action possible' : ''}`);

  if (s.devices.length) {
    lines.push('', 'devices (sessions, bounce):');
    for (const d of s.devices.slice(0, 4)) lines.push(`${d.name.toLowerCase()}: ${num(d.sessions.cur)} sessions, bounce ${Math.round(d.bounceRate.cur)}%`);
  }
  if (s.channels.length) {
    lines.push('', 'channels (visitors, pages/visit, bounce):');
    for (const c of s.channels.slice(0, 5)) lines.push(`${c.name}: ${num(c.visitors.cur)} visitors, ${c.pagesPerSession.cur.toFixed(1)} pages, bounce ${Math.round(c.bounceRate.cur)}%`);
  }
  if (s.pages.length) {
    lines.push('', 'top pages (views):');
    for (const p of s.pages.slice(0, 8)) lines.push(`${p.path}: ${num(p.views.cur)} (${pctChange(p.views.cur, p.views.prev)})`);
  }

  let text = lines.join('\n');
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
  return { text, numbers: numbersIn(text) };
}

/** Every number a text states, as plain digits: `12,400` and `12400` are the same figure, and a rounded form of each is allowed too. */
export function numbersIn(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = match[0].replace(/,/g, '');
    found.add(raw);
    const n = Number(raw);
    if (Number.isFinite(n)) {
      found.add(String(Math.round(n)));
      if (!Number.isInteger(n)) found.add(n.toFixed(1));
    }
  }
  return found;
}
