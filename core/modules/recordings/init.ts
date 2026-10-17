import { recordedSessions } from "./repositories/recording-presence.repository";
import { recordingsLane } from "./ingest-lane";
import type { WebsitesModule } from "../websites/interfaces";
import type { RecordingDetail, RecordingsModule, SessionSummarizer } from "./interfaces";
import { RecordingUsageCounter } from "./services/usage-count.service";
import { RecordingSiteMetrics } from "./services/agency-site-metrics.service";
import { createRecordingRoutes } from "./routes";
import { RecordingRawReadService } from "./services/recording-raw-read.service";
import {
  configureRecordingStylesheetSink,
  recordingIngestService,
  stopRecordingIngestService,
} from "./services/recording-ingest.service";
import { batchDeleteReplaySessions } from "./services/recording-session-deletion.service";
import { getReplaySessionDetail } from "./services/recording-session-detail.service";
import { listReplaySessions } from "./services/recording-session-list.service";
import { RecordingRetentionPurge } from "./services/retention-purge.service";
import { readSessionAnalysisConfig, SessionAnalysisService } from "./services/session-analysis.service";
import { loadRecordingEvents } from "./services/frustration/recording-event-loader";
import { PostgresSessionAnalysisStore } from "./repositories/session-analysis.repository";
import { stylesheetArchive } from "./services/stylesheets/stylesheet-archive";

/** Build the recordings module. */
export function initRecordingsModule(deps: {
  websitesModule: WebsitesModule;
  /**
   * Writes session summaries; the AI module's, read when a summary is asked for (that
   * module is composed after this one). Absent or returning `null`: no model is
   * configured, and analyses carry signals only.
   */
  sessionSummarizer?: () => SessionSummarizer | null;
}): RecordingsModule {
  const analysis = new SessionAnalysisService({
    store: new PostgresSessionAnalysisStore(),
    load: loadRecordingEvents,
    summarizer: () => deps.sessionSummarizer?.() ?? null,
    config: readSessionAnalysisConfig(),
  });

  const stylesheets = stylesheetArchive();
  // Ingest reports each stored batch's stylesheet links to the archive (best-effort).
  configureRecordingStylesheetSink((websiteId, events) => stylesheets.discoverFromReplayEvents(websiteId, events));

  /**
   * A recording, with the capability its player needs to load the site's archived
   * stylesheets. Here rather than in the detail service so both callers — the dashboard
   * route and the embed API — get it from the one read they already authorize.
   */
  const getSessionDetail = async (websiteId: string, sessionId: string): Promise<RecordingDetail> => {
    const detail = await getReplaySessionDetail(websiteId, sessionId);
    if (detail.status !== 200) return detail;
    const access = stylesheets.accessToken(websiteId);
    return {
      ...detail,
      body: { ...detail.body, stylesheet_token: access.token, stylesheet_token_expires_at: access.expiresAt },
    } as RecordingDetail;
  };

  return {
    lane: recordingsLane(() => recordingIngestService()),

    // This module's own accessor, called here rather than reached for by ingest — which is
    // what removed ingest's edge into a process-wide singleton it could not stub.
    ingest: () => recordingIngestService(),
    retention: new RecordingRetentionPurge(stylesheets),
    usage: new RecordingUsageCounter(),
    agencyMetrics: new RecordingSiteMetrics(),
    rawReads: new RecordingRawReadService(),
    reads: { listSessions: listReplaySessions, getSessionDetail },
    routes: createRecordingRoutes({
      recordingList: { listSessions: listReplaySessions },
      recordingDetails: { getSessionDetail },
      recordingDeletion: { batchDelete: batchDeleteReplaySessions },
      recordingAnalysis: analysis,
      websites: deps.websitesModule.accessChecks,
    }),
    analysis,
    analysisJobs: analysis,
    presence: { recorded: recordedSessions },
    stylesheets,

    // Constructing the service arms the chunk flush timer and opens a storage client, so
    // it happens here rather than at build time — same reason as the heatmap engine. The
    // accessor is idempotent: an ingest that beat `start()` already built one, and
    // replacing it would strand that timer and whatever it had buffered.
    start() {
      recordingIngestService();
    },

    // Never constructs one just to tear it down — `recordingIngestService().shutdown()` would.
    async stop() {
      await stopRecordingIngestService();
    },
  };
}
