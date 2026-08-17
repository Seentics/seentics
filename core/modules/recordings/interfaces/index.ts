/**
 * Public contracts for the recordings module.
 *
 * Note the naming split documented in `recording.interface.ts`: the domain says
 * "recording", the HTTP path and the `session_replays` table still say "replay".
 */
export type {
  RecordingDetail,
  RecordingMutations,
  RecordingQuery,
  RecordingSettings,
  RecordingSummary,
} from "./recording.interface";
