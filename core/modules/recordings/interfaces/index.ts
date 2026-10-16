/**
 * Public contracts for the recordings module.
 *
 * Note the naming split documented in `recording.interface.ts`: the domain says
 * "recording", the HTTP path and the `session_replays` table still say "replay".
 */
export type {
  SessionMetaRow,
  RecordingChunkUrl,
  RecordingDetail,
  RecordingDetailMeta,
  RecordingIngest,
  RecordingMutations,
  RecordingQuery,
  RecordingSummary,
  SessionListFilters,
  SessionListSummary,
} from "./recording.interface";

/** The whole module surface, as a peer receives it at composition time. */
export type { RecordingPresence, RecordingsModule } from "./recordings.module";

export type { RecordingRawReads } from "./recording.interface";

export type {
  StylesheetAccess,
  StylesheetArchive,
  StylesheetArchiveJobs,
  StylesheetArchiveRunStats,
  StylesheetDiscovery,
  StylesheetServeResult,
  StylesheetServing,
} from "./stylesheet-archive.interface";

export type {
  AnalyzeRunStats,
  FrustratedSessionRow,
  FrustrationSignal,
  FrustrationSignalType,
  SessionAnalysisJobs,
  SessionAnalysisReads,
  SessionAnalysisView,
  SessionSummarizer,
  SessionSummary,
  SessionSummaryInput,
  SessionSummaryResult,
  SessionSummaryStatus,
  SessionTimeline,
  SignalCounts,
  SummaryRunStats,
} from "./session-analysis.interface";
export { FRUSTRATION_SIGNAL_TYPES, isFrustrationSignalType } from "./session-analysis.interface";

/** Query contract of the list read, shared with the embed API. */
export { replayListQuerySchema } from "../validators/recording.schema";
