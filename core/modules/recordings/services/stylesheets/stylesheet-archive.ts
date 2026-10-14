import { env } from "../../../../config";
import { deleteS3Objects, getText, putCss } from "../../../../platform/storage/s3";
import { PostgresStylesheetStore } from "../../repositories/stylesheet.repository";
import { loadRecordingEvents } from "../frustration/recording-event-loader";
import { readStylesheetArchiveConfig, StylesheetArchiveService } from "./stylesheet-archive.service";

let _archive: StylesheetArchiveService | null = null;

/**
 * The process-wide archive over Postgres and the replays bucket.
 *
 * An accessor for the same reason as `recordingIngestService()`: the ingest engine is built
 * lazily from free functions and needs the archive for discovery, and `initRecordingsModule`
 * hands the same instance to its peers. Constructing it opens nothing.
 */
export function stylesheetArchive(): StylesheetArchiveService {
  if (_archive) return _archive;
  const bucket = env().s3.bucket;
  _archive = new StylesheetArchiveService({
    store: new PostgresStylesheetStore(),
    storage: {
      put: (key, css) => putCss(bucket, key, css),
      get: (key) => getText(bucket, key),
      delete: (keys) => deleteS3Objects(bucket, keys),
    },
    loadRecording: async (websiteId, sessionId, maxChunks) =>
      (await loadRecordingEvents(websiteId, sessionId, maxChunks))?.rows ?? null,
    config: readStylesheetArchiveConfig(),
  });
  return _archive;
}
