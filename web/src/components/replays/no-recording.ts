import { replaysEn, type ReplaysMessages } from '@/lib/i18n/messages/replays-en';

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

export function noRecordingReason({
  durationSeconds,
  signalTypes,
}: {
  durationSeconds: number | null | undefined;
  /** The types of the side events captured: network_event, console_event, session_error. */
  signalTypes: readonly string[];
}, m: ReplaysMessages = replaysEn): NoRecordingReason {
  const t = m.noRecording;
  const seconds = Math.max(0, Math.round(durationSeconds ?? 0));
  if (seconds < TOO_SHORT_S) {
    return {
      title: t.tooShortTitle,
      body: seconds === 0 ? t.tooShortInstant : t.tooShort(seconds),
    };
  }

  const kinds = new Set(signalTypes);
  const captured = [
    kinds.has('network_event') && t.network,
    kinds.has('console_event') && t.console,
    kinds.has('session_error') && t.errors,
  ].filter((k): k is string => !!k);
  if (captured.length) {
    return {
      title: t.blockedTitle,
      body: t.blocked(t.list(captured)),
    };
  }

  return {
    title: t.noneTitle,
    body: t.none,
  };
}
