/**
 * Why a session has no page recording, from what was captured instead.
 *
 * The empty state listed every possible cause, in rrweb and storage terms, whatever had
 * happened. What the session holds narrows it: a visit of a second or two ended before the
 * recorder loaded; a longer one with network or console activity but no page means the
 * recorder was stopped in that browser; one with nothing at all was not recorded.
 */

/** How short a visit has to be for "left before the recorder loaded" to be the likely reason. */
const TOO_SHORT_S = 3;

export type NoRecordingReason = { title: string; body: string };

const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export function noRecordingReason({
  durationSeconds,
  signalTypes,
}: {
  durationSeconds: number | null | undefined;
  /** The types of the side events captured: network_event, console_event, session_error. */
  signalTypes: readonly string[];
}): NoRecordingReason {
  const seconds = Math.max(0, Math.round(durationSeconds ?? 0));
  if (seconds < TOO_SHORT_S) {
    return {
      title: 'The visit was too short to record',
      body: seconds === 0
        ? 'The visitor left almost at once, before the page recorder had loaded. There is nothing to play.'
        : `The visitor left after ${seconds} ${seconds === 1 ? 'second' : 'seconds'}, before the page recorder had loaded. There is nothing to play.`,
    };
  }

  const kinds = new Set(signalTypes);
  const captured = [
    kinds.has('network_event') && 'network requests',
    kinds.has('console_event') && 'console messages',
    kinds.has('session_error') && 'errors',
  ].filter((k): k is string => !!k);
  if (captured.length) {
    return {
      title: 'The page recorder didn’t start',
      body: `This visit’s ${list(captured)} were captured, but the page itself wasn’t: the recorder was blocked in this visitor’s browser. That is usually an ad or privacy blocker, a strict browser setting, or your site’s Content Security Policy blocking scripts from seentics.com.`,
    };
  }

  return {
    title: 'No recording for this session',
    body: 'Seentics counted this visit, but nothing from it was recorded. Recording may have been off for this site, or the monthly recording limit had been reached when the visit happened.',
  };
}
