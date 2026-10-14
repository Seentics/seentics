import type { SessionRow } from './list-types';
import type { SessionGroup } from './types';

export type SessionGroupMeta = {
  id: SessionGroup;
  label: string;
  description: string;
  /** Tailwind class for the group's dot. */
  dot: string;
};

/** The groups the session list is browsed by, in the order they are shown. Mirrors core's SESSION_GROUPS. */
export const SESSION_GROUP_META: SessionGroupMeta[] = [
  { id: 'smooth',      label: 'Smooth sessions', description: 'No friction found',                          dot: 'bg-emerald-500' },
  { id: 'gave_up',     label: 'Gave up',         description: 'Came to do something and left without it',   dot: 'bg-red-500' },
  { id: 'errors',      label: 'Errors',          description: 'Hit a JavaScript or network error',          dot: 'bg-red-500' },
  { id: 'rage',        label: 'Rage clicks',     description: 'Clicked the same spot over and over',        dot: 'bg-orange-500' },
  { id: 'dead_clicks', label: 'Dead clicks',     description: 'Clicked things that did nothing',            dot: 'bg-amber-400' },
  { id: 'forms',       label: 'Abandoned forms', description: 'Started filling a form and gave up',         dot: 'bg-amber-400' },
  { id: 'u_turns',     label: 'U-turns',         description: 'Left a page within seconds and came back',   dot: 'bg-sky-500' },
  { id: 'thrash',      label: 'Scroll thrash',   description: 'Scrolled back and forth, searching',         dot: 'bg-sky-500' },
];

/** Whether a row belongs to a group — the browser's copy of core's GROUP_PREDICATE, for the demo. */
export function inSessionGroup(row: Pick<SessionRow, 'frustration_score' | 'signal_counts' | 'has_errors' | 'has_rage_clicks' | 'summary'>, group: SessionGroup): boolean {
  const n = (k: string) => Number((row.signal_counts as Record<string, number> | null)?.[k] ?? 0) > 0;
  const gaveUp = /\b(left without|gave up|abandon)/i.test(row.summary ?? '');
  switch (group) {
    case 'smooth': return row.frustration_score != null && row.frustration_score < 10 && !row.has_errors && !row.has_rage_clicks && !gaveUp;
    case 'errors': return row.has_errors || n('error_click');
    case 'rage': return row.has_rage_clicks || n('rage_click');
    case 'dead_clicks': return n('dead_click');
    case 'forms': return n('form_abandon');
    case 'u_turns': return n('u_turn');
    case 'thrash': return n('scroll_thrash');
    case 'gave_up': return gaveUp;
  }
}
