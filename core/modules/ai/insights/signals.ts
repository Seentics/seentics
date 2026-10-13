import type { ActionHint, Evidence, EvidenceKind, InsightSnapshot, Pair, Signal } from './types';

/**
 * Deciding what is worth saying: week-over-week changes, scored and ranked in code.
 *
 * The model is never asked to find the story in a pile of numbers. It is given the few
 * signals that cleared these thresholds, with the figures already worked out, and asked to
 * word them. So what an owner reads is something the data says, and a quiet week yields
 * few or no signals instead of a confident invention.
 */

/** Thresholds, exported so the tests state them and a change to one is a visible decision. */
export const THRESHOLDS = {
  /** Visitors in the window before an insight is generated at all. Below it: "not enough data". */
  minVisitors: 100,
  /** A change is ignored below this share, however large the volume. */
  minChange: { traffic: 0.15, conversion: 0.2, device: 0.25, page: 0.3, bounceTenths: 80, channel: 0.5 },
  /** The earlier window must have had at least this much behind it, or a percentage is noise. */
  minPrev: { traffic: 100, conversion: 20, deviceSessions: 100, pageViews: 50, channelVisitors: 50, errorCount: 10 },
  /** Kept in the brief. */
  maxSignals: 10,
} as const;

/** `(cur - prev) / prev`, or null when there was nothing before to compare with. */
export const change = (p: Pair): number | null => (p.prev > 0 ? (p.cur - p.prev) / p.prev : null);

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (rel: number) => `${rel >= 0 ? '+' : '-'}${Math.round(Math.abs(rel) * 100)}%`;
const share = (n: number) => `${Math.round(n)}%`;
const direction = (rel: number) => (rel >= 0 ? 'rose' : 'fell');

/** Importance: how far it moved, weighted by how many visits are behind it. */
const scoreOf = (rel: number, volume: number, weight = 1) => Math.min(Math.abs(rel), 1.5) * Math.log10(volume + 10) * weight;

const ev = (kind: EvidenceKind, label: string): Evidence => ({ kind, label });

/** Conversion rate of a segment: conversions per session, as a percentage. */
const rate = (conversions: number, sessions: number) => (sessions > 0 ? (conversions / sessions) * 100 : 0);

export function detectSignals(s: InsightSnapshot): Signal[] {
  const out: Signal[] = [];
  const t = s.traffic;
  const window = `the last ${s.days} days`;
  const vs = `the ${s.days} days before`;

  // Visitors.
  const visitorChange = change(t.visitors);
  if (visitorChange !== null && t.visitors.prev >= THRESHOLDS.minPrev.traffic && Math.abs(visitorChange) >= THRESHOLDS.minChange.traffic) {
    out.push({
      id: 'traffic.visitors',
      kind: 'traffic',
      score: scoreOf(visitorChange, t.visitors.prev, 1.2),
      text: `Visitors ${direction(visitorChange)} ${Math.round(Math.abs(visitorChange) * 100)}% over ${window}: ${num(t.visitors.cur)} against ${num(t.visitors.prev)} in ${vs}.`,
      brief: `visitors ${num(t.visitors.cur)} (${pct(visitorChange)}), prev ${num(t.visitors.prev)}`,
      evidence: ev('traffic', 'Traffic over time'),
    });
  }

  // Bounce rate, in percentage points.
  const bounceDelta = t.bounceRate.cur - t.bounceRate.prev;
  if (t.sessions.prev >= THRESHOLDS.minPrev.traffic && Math.abs(bounceDelta) * 10 >= THRESHOLDS.minChange.bounceTenths) {
    out.push({
      id: 'traffic.bounce',
      kind: 'bounce',
      score: scoreOf(bounceDelta / 40, t.sessions.cur, 0.8),
      text: `Bounce rate ${direction(bounceDelta)} ${Math.round(Math.abs(bounceDelta))} points to ${share(t.bounceRate.cur)} (from ${share(t.bounceRate.prev)}) over ${window}.`,
      brief: `bounce ${share(t.bounceRate.cur)} (${bounceDelta >= 0 ? '+' : '-'}${Math.round(Math.abs(bounceDelta))}pt), prev ${share(t.bounceRate.prev)}`,
      evidence: ev('bounce', 'Entry and exit pages'),
    });
  }

  // The main conversion event, overall and per device.
  if (s.conversion) {
    const c = s.conversion;
    const rel = change(c.count);
    if (rel !== null && c.count.prev >= THRESHOLDS.minPrev.conversion && Math.abs(rel) >= THRESHOLDS.minChange.conversion) {
      out.push({
        id: `conversion.${slug(c.event)}`,
        kind: 'conversion',
        score: scoreOf(rel, c.count.prev, 1.6),
        text: `"${c.event}" ${direction(rel)} ${Math.round(Math.abs(rel) * 100)}% over ${window}: ${num(c.count.cur)} against ${num(c.count.prev)} in ${vs}.`,
        brief: `conversion "${c.event}" ${num(c.count.cur)} (${pct(rel)}), prev ${num(c.count.prev)}`,
        evidence: ev('conversion', `"${c.event}" in your funnels`),
      });
    }
    for (const d of s.devices) {
      if (d.sessions.prev < THRESHOLDS.minPrev.deviceSessions || d.sessions.cur < THRESHOLDS.minPrev.deviceSessions / 2) continue;
      const cur = rate(d.conversions.cur, d.sessions.cur);
      const prev = rate(d.conversions.prev, d.sessions.prev);
      if (prev <= 0) continue;
      const r = (cur - prev) / prev;
      if (Math.abs(r) < THRESHOLDS.minChange.device) continue;
      const device = d.name.toLowerCase();
      out.push({
        id: `device.${slug(device)}.conversion`,
        kind: 'device',
        score: scoreOf(r, d.sessions.prev, 1.5),
        text: `${cap(device)} conversion ${direction(r)} ${Math.round(Math.abs(r) * 100)}%: ${rateText(cur)} of ${device} sessions converted, against ${rateText(prev)} in ${vs}.`,
        brief: `device ${device}: "${c.event}" rate ${rateText(cur)} (${pct(r)}), prev ${rateText(prev)}, sessions ${num(d.sessions.cur)}`,
        evidence: ev('device', `${cap(device)} sessions`),
        action: r < 0 ? {
          title: `Recover ${device} conversions`,
          prompt: `${cap(device)} visitors are converting ${Math.round(Math.abs(r) * 100)}% less than before. Draft an automation that helps ${device} visitors who are about to leave without converting.`,
        } : undefined,
      });
    }
  }

  // Channels that behave differently from the site as a whole.
  const siteBounce = t.bounceRate.cur;
  for (const ch of s.channels) {
    if (ch.visitors.cur < THRESHOLDS.minPrev.channelVisitors) continue;
    const siteAvgPages = t.sessions.cur > 0 ? t.pageviews.cur / t.sessions.cur : 0;
    const pagesRatio = siteAvgPages > 0 ? ch.pagesPerSession.cur / siteAvgPages : 1;
    const bounceGap = ch.bounceRate.cur - siteBounce;
    const name = ch.name;
    if (pagesRatio >= 1 + THRESHOLDS.minChange.channel) {
      out.push({
        id: `channel.${slug(name)}.engaged`,
        kind: 'channel',
        score: scoreOf(pagesRatio - 1, ch.visitors.cur, 0.9),
        text: `Visitors from ${name} view ${ratioText(pagesRatio)} as many pages per visit as the average (${ch.pagesPerSession.cur.toFixed(1)} against ${siteAvgPages.toFixed(1)}).`,
        brief: `channel ${name}: visitors ${num(ch.visitors.cur)}, pages/visit ${ch.pagesPerSession.cur.toFixed(1)} vs site ${siteAvgPages.toFixed(1)} (${ratioText(pagesRatio)})`,
        evidence: ev('channel', `${name} traffic`),
      });
    } else if (bounceGap >= 25) {
      out.push({
        id: `channel.${slug(name)}.bounce`,
        kind: 'channel',
        score: scoreOf(bounceGap / 50, ch.visitors.cur, 0.9),
        text: `${cap(name)} visitors bounce ${Math.round(bounceGap)} points more than average: ${share(ch.bounceRate.cur)} against ${share(siteBounce)}.`,
        brief: `channel ${name}: visitors ${num(ch.visitors.cur)}, bounce ${share(ch.bounceRate.cur)} vs site ${share(siteBounce)}`,
        evidence: ev('channel', `${cap(name)} traffic`),
      });
    }
  }

  // Pages that moved a lot.
  for (const p of s.pages) {
    const rel = change(p.views);
    if (rel === null || p.views.prev < THRESHOLDS.minPrev.pageViews || Math.abs(rel) < THRESHOLDS.minChange.page) continue;
    out.push({
      id: `page.${slug(p.path)}`,
      kind: 'page',
      score: scoreOf(rel, p.views.prev, 0.8),
      text: `Views of ${p.path} ${direction(rel)} ${Math.round(Math.abs(rel) * 100)}%: ${num(p.views.cur)} against ${num(p.views.prev)} in ${vs}.`,
      brief: `page ${p.path}: views ${num(p.views.cur)} (${pct(rel)}), prev ${num(p.views.prev)}`,
      evidence: ev('page', `Pages and paths`),
    });
  }

  // Errors people are hitting.
  for (const [i, e] of s.errors.entries()) {
    if (e.count < THRESHOLDS.minPrev.errorCount) continue;
    out.push({
      id: `error.${i + 1}`,
      kind: 'error',
      score: scoreOf(e.isNew ? 1 : 0.6, e.count * 20, 1.4),
      text: `${e.isNew ? 'A new error' : 'An error'} happened ${num(e.count)} times on ${e.page}: ${e.message}`,
      brief: `error${e.isNew ? ' (new)' : ''}: "${e.message}" on ${e.page}, ${num(e.count)} times`,
      evidence: ev('error', 'Errors'),
      action: { title: 'Get alerted about errors', prompt: `Draft an automation that sends a webhook to my team when a JavaScript error happens on ${e.page}.` },
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, THRESHOLDS.maxSignals);
}

/** A signal id the brief can quote and the model can repeat: lowercase letters, digits and `./_-`. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9./_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'x';

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const rateText = (r: number) => `${r.toFixed(r < 10 ? 1 : 0)}%`;
const ratioText = (r: number) => `${(Math.round(r * 10) / 10).toFixed(1)}×`;
