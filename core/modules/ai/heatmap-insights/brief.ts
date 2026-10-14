import type { HeatmapDeviceAnalysis, HeatmapPageAnalysis } from '../../heatmaps/interfaces';
import { numbersIn, type Brief } from '../insights/brief';
import { maskPath, maskText } from '../insights/privacy';

/**
 * The brief the model words one page's heatmap from: the signals the heatmaps module found,
 * each with its compact facts, and a few lines of context. Every figure the model may quote is
 * in here, which is what lets the output be checked against it (output.ts).
 *
 * Selectors and the path come from the site's own markup and URLs, which can carry an id or an
 * email; both are masked before they reach a model. A few hundred tokens in practice.
 */

const MAX_CHARS = 6000;
/** Signals offered to the model at most. More is noise for a five-finding answer. */
export const MAX_BRIEF_SIGNALS = 8;

function deviceLine(a: HeatmapDeviceAnalysis): string {
  const parts: string[] = [];
  if (a.scroll) {
    parts.push(`${a.scroll.page_views} page views, median stop ${a.scroll.median_depth}%`);
    if (a.scroll.fold_pct !== null) parts.push(`fold ${a.scroll.fold_pct}%`);
  }
  if (a.clicks) {
    parts.push(`${a.clicks.clicks} clicks`);
    if (a.clicks.clicks_per_view !== null) parts.push(`${a.clicks.clicks_per_view} clicks per page view`);
    if (a.clicks.dead_clicks.known_share >= 50) parts.push(`dead-click candidates ${a.clicks.dead_clicks.share}%`);
  }
  return `${a.device}: ${parts.join(', ')}`;
}

export function buildHeatmapBrief(a: HeatmapPageAnalysis): Brief {
  const lines: string[] = [];
  lines.push(`page: ${maskPath(a.page_path)}`);
  lines.push(`period: last ${a.days} days; device: ${a.device === 'all' ? 'all devices' : a.device}`);
  lines.push(deviceLine(a.overall));

  lines.push('', 'signals, most important first (cite by id):');
  for (const s of a.signals.slice(0, MAX_BRIEF_SIGNALS)) lines.push(`[${s.id}] ${maskText(s.facts, 400)}`);

  const top = a.overall.clicks?.top ?? [];
  if (top.length) {
    lines.push('', 'most-clicked elements (share of clicks, position down the page, share of page views reaching it):');
    for (const t of top.slice(0, 5)) {
      const kind = t.interactive === true ? 'interactive' : t.interactive === false ? 'not interactive' : 'type unknown';
      const reach = t.pinned ? 'always visible' : t.reach_pct === null ? 'reach unknown' : `${t.reach_pct}% reach it`;
      lines.push(`${maskText(t.selector, 80)} (${t.tag ?? '?'}, ${kind}): ${t.share}%, at ${t.depth_pct}%, ${reach}`);
    }
  }
  if (a.devices.length > 1) {
    lines.push('', 'by device:');
    for (const d of a.devices) lines.push(deviceLine(d));
  }
  lines.push('', 'not measured: rage clicks, time spent per section, unique visitors (figures are page views), what happened after a click.');

  let text = lines.join('\n');
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
  return { text, numbers: numbersIn(text) };
}
