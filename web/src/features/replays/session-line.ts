import { entryPathDisplay } from './format';
import type { SessionRow } from './list-types';
import type { FrustrationSignalType } from './types';
import { FRUSTRATED_MIN_SCORE, signalChips } from './analysis';
import type { DotTone } from '@/components/ui/linear-list';
import { replaysEn, type ReplaysMessages } from '@/lib/i18n/messages/replays-en';

/**
 * Which group a session sits in.
 *
 * `look`: something went wrong — an error, a rage cluster, or a frustration score at the
 * "Frustrated" threshold. `smooth`: analysed and calm. `watch`: everything else — left
 * without converting, or not analysed yet.
 */
export type SessionLevel = 'look' | 'watch' | 'smooth';

export function sessionLevel(s: Pick<SessionRow, 'has_errors' | 'has_rage_clicks' | 'frustration_score'>): SessionLevel {
  if (s.has_errors || s.has_rage_clicks || (s.frustration_score ?? 0) >= FRUSTRATED_MIN_SCORE) return 'look';
  if (s.frustration_score != null && s.frustration_score < 10) return 'smooth';
  return 'watch';
}

const SIGNAL_TONE: Record<FrustrationSignalType, DotTone> = {
  error_click: 'red',
  rage_click: 'orange',
  form_abandon: 'violet',
  dead_click: 'indigo',
  u_turn: 'grey',
  scroll_thrash: 'grey',
};

/**
 * A session's signal labels: the analysis's signals, most severe first, plus the ingest
 * flags for a session not analysed yet (or one whose analysis missed them).
 */
export function sessionTags(
  s: Pick<SessionRow, 'signal_counts' | 'has_errors' | 'has_rage_clicks'>,
  m: ReplaysMessages = replaysEn,
): Array<{ label: string; tone: DotTone }> {
  const tag = (type: FrustrationSignalType) => ({ label: m.signals[type].label, tone: SIGNAL_TONE[type] });
  const chips = signalChips(s.signal_counts);
  const tags = chips.map((c) => tag(c.type));
  if (s.has_errors && !chips.some((c) => c.type === 'error_click')) tags.unshift({ label: m.line.jsError, tone: 'red' });
  if (s.has_rage_clicks && !chips.some((c) => c.type === 'rage_click')) {
    tags.splice(s.has_errors ? 1 : 0, 0, tag('rage_click'));
  }
  return tags;
}

/**
 * The row's icon: urgent for an error, signal bars (the tallest in the worst signal's
 * colour) for frustration short of one, flat dashes for nothing to report.
 */
export function sessionIcon(s: Pick<SessionRow, 'signal_counts' | 'has_errors' | 'has_rage_clicks' | 'frustration_score'>):
  { kind: 'urgent' } | { kind: 'bars'; tone: DotTone } | { kind: 'calm' } {
  const tags = sessionTags(s);
  if (tags[0]?.tone === 'red') return { kind: 'urgent' };
  if (tags.length > 0 || sessionLevel(s) === 'look') return { kind: 'bars', tone: tags[0]?.tone ?? 'orange' };
  return { kind: 'calm' };
}

/** One line on what happened: the server's summary, else what the ingest flags and page count say. */
export function sessionLine(
  s: Pick<SessionRow, 'summary' | 'has_errors' | 'has_rage_clicks' | 'pages_viewed' | 'entry_page' | 'frustration_score'>,
  websiteId: string,
  m: ReplaysMessages = replaysEn,
): string {
  if (s.summary) return s.summary;
  const t = m.line;
  const pages = t.pages(s.pages_viewed, entryPathDisplay(s.entry_page, websiteId).display);
  if (s.has_errors && s.has_rage_clicks) return t.errorsAndRage(pages);
  if (s.has_errors) return t.error(pages);
  if (s.has_rage_clicks) return t.rage(pages);
  return s.frustration_score != null ? t.smooth(pages) : t.browsed(pages);
}
