import type { HeatmapInsightFinding, HeatmapSignalKind } from '../../heatmaps/interfaces';
import type { FrustratedSessionRow, FrustrationSignalType } from '../../recordings/interfaces';
import type { EvidenceKind, InsightLine } from '../insights/types';
import type { MetricName, RecommendationCandidate, RecommendationTarget } from './types';

/**
 * Turning what the product already found into recommendations. Pure: the job hands these the
 * stored outputs and gets candidates back, so what becomes a recommendation is tested without a
 * database or a model.
 *
 * Each candidate carries a `dedupeKey` built from what it is about, never from the day's figures:
 * "Recover mobile conversions" is the same suggestion whether mobile is down 31% today or 28%
 * tomorrow, so repeated daily runs refresh one row instead of stacking up copies.
 */

/** Long enough for a specific ask; inside the web composer's prefill limit (500). */
export const MAX_PROMPT = 480;
const MAX_TITLE = 120;
const MAX_RATIONALE = 300;

/** Per source and site, per run. A panel of thirty suggestions is a panel nobody reads. */
export const MAX_PER_SOURCE = 5;
/** Sessions on one entry page before frustration there is a pattern rather than one bad visit. */
export const MIN_FRUSTRATED_SESSIONS = 3;

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

/** A key segment: lowercase, no spaces, bounded. Paths keep their slashes. */
export const keyPart = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9/_.:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

const sitePageTarget = (path: string): RecommendationTarget => ({ kind: 'page', ref: path, label: path });

/** What an insight's evidence kind is meant to move. */
const INSIGHT_METRIC: Record<EvidenceKind, MetricName> = {
  traffic: 'none',
  bounce: 'bounce_rate',
  conversion: 'conversion_rate',
  device: 'conversion_rate',
  channel: 'bounce_rate',
  page: 'bounce_rate',
  error: 'none',
};

/**
 * The daily insight's suggested actions. Only `action` lines with a prompt: a finding is something
 * to know, not something to do.
 */
export function fromInsight(insight: { insightDate: string; lines: InsightLine[] }): RecommendationCandidate[] {
  const out: RecommendationCandidate[] = [];
  for (const line of insight.lines) {
    if (line.kind !== 'action' || !line.action?.prompt?.trim() || !line.action.title?.trim()) continue;
    const a = line.action;
    const t = a.target;
    const target: RecommendationTarget = t?.kind === 'page' && t.ref
      ? sitePageTarget(t.ref)
      : t?.device
        ? { kind: 'site', ref: null, label: `${cap(t.device)} visitors`, device: t.device }
        : { kind: 'site', ref: null, label: 'the site' };
    const metricName = INSIGHT_METRIC[line.evidence?.kind ?? 'traffic'] ?? 'none';
    out.push({
      source: 'insight',
      sourceRef: `${insight.insightDate}:${keyPart(a.title)}`,
      dedupeKey: ['insight', line.evidence?.kind ?? 'x', keyPart(target.ref), keyPart(target.device), keyPart(a.title)].join('|'),
      title: clip(a.title, MAX_TITLE),
      rationale: clip(line.text, MAX_RATIONALE),
      prompt: clip(a.prompt, MAX_PROMPT),
      target,
      metric: { name: metricName, windowDays: 14 },
    });
  }
  return out.slice(0, MAX_PER_SOURCE);
}

const HEATMAP_TITLE: Record<HeatmapSignalKind, string> = {
  scroll_depth: 'Move key content higher',
  fold: 'Bring the main action above the fold',
  click_concentration: 'Rework what people click',
  dead_clicks: 'Fix dead clicks',
  cta_reach: 'Put the call to action where people reach',
  device_gap: 'Fix the mobile and desktop gap',
  low_engagement: 'Make the page more engaging',
};

/**
 * Heatmap findings with their fixes, from the stored wording of pages someone opened recently.
 * One recommendation per page and signal; the `all` device row wins over a per-device one.
 */
export function fromHeatmaps(rows: Array<{ pagePath: string; device: string; findings: HeatmapInsightFinding[] }>): RecommendationCandidate[] {
  const ordered = [...rows].sort((a, b) => (a.device === 'all' ? -1 : 0) - (b.device === 'all' ? -1 : 0));
  const seen = new Set<string>();
  const out: RecommendationCandidate[] = [];
  for (const row of ordered) {
    let perPage = 0;
    for (const f of row.findings) {
      if (perPage >= 2 || !f.fix?.trim()) continue;
      const dedupeKey = ['heatmap', keyPart(row.pagePath), keyPart(f.kind)].join('|');
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      perPage++;
      out.push({
        source: 'heatmap',
        sourceRef: `${row.pagePath}:${f.signal}`,
        dedupeKey,
        title: clip(`${HEATMAP_TITLE[f.kind] ?? 'Act on the heatmap'} on ${row.pagePath}`, MAX_TITLE),
        rationale: clip(f.finding, MAX_RATIONALE),
        prompt: clip(
          `The heatmap for ${row.pagePath} shows: ${f.finding} Suggested fix: ${f.fix} ` +
          `Help me act on this: draft an automation if one would help (a banner, nudge or popup on ${row.pagePath}), or tell me exactly what to change on the page.`,
          MAX_PROMPT,
        ),
        target: sitePageTarget(row.pagePath),
        metric: { name: 'bounce_rate', windowDays: 14 },
      });
    }
  }
  return out.slice(0, MAX_PER_SOURCE);
}

const FRUSTRATION_LABEL: Record<FrustrationSignalType, string> = {
  rage_click: 'rage clicks',
  error_click: 'clicks that hit an error',
  form_abandon: 'abandoned forms',
  dead_click: 'dead clicks',
  u_turn: 'quick U-turns',
  scroll_thrash: 'scroll thrashing',
};

/**
 * Entry pages where several recorded sessions showed frustration in the window. One visitor having
 * a bad time is a replay to watch; three on the same page is a page to fix.
 */
export function fromSessions(rows: FrustratedSessionRow[], days: number): RecommendationCandidate[] {
  const byPage = new Map<string, { sessions: number; counts: Map<FrustrationSignalType, number> }>();
  for (const r of rows) {
    const page = (r.entryPage || '').trim();
    if (!page) continue;
    const g = byPage.get(page) ?? { sessions: 0, counts: new Map() };
    g.sessions++;
    for (const [type, n] of Object.entries(r.counts ?? {})) {
      if (!(type in FRUSTRATION_LABEL) || !n) continue;
      const t = type as FrustrationSignalType;
      g.counts.set(t, (g.counts.get(t) ?? 0) + Number(n));
    }
    byPage.set(page, g);
  }

  const out: RecommendationCandidate[] = [];
  const pages = [...byPage.entries()]
    .filter(([, g]) => g.sessions >= MIN_FRUSTRATED_SESSIONS && g.counts.size > 0)
    .sort((a, b) => b[1].sessions - a[1].sessions);
  for (const [page, g] of pages) {
    const [type, count] = [...g.counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const label = FRUSTRATION_LABEL[type];
    out.push({
      source: 'session',
      sourceRef: `${page}:${type}`,
      dedupeKey: ['session', keyPart(page), type].join('|'),
      title: clip(`Fix ${label} on ${page}`, MAX_TITLE),
      rationale: clip(`${g.sessions} recorded sessions that started on ${page} in the last ${days} days showed frustration, mostly ${label} (${count}).`, MAX_RATIONALE),
      prompt: clip(
        `${g.sessions} recorded sessions that started on ${page} in the last ${days} days show frustration, mostly ${label}. ` +
        `Use the session tools to find what went wrong there, then draft an automation that helps visitors who struggle on ${page}.`,
        MAX_PROMPT,
      ),
      target: sitePageTarget(page),
      metric: { name: 'bounce_rate', windowDays: 14 },
    });
  }
  return out.slice(0, MAX_PER_SOURCE);
}
