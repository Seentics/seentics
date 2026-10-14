import type { WebsiteQuery } from "../../websites/interfaces";
import type { RecordingMutations, RecordingQuery, SessionAnalysisReads } from "../interfaces";

export type RecordingControllerDeps = {
  recordingList: Pick<RecordingQuery, "listSessions">;
  recordingDetails: Pick<RecordingQuery, "getSessionDetail">;
  recordingDeletion: RecordingMutations;
  recordingAnalysis: Pick<SessionAnalysisReads, "getAnalysis">;
  websites: WebsiteQuery;
};
