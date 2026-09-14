import { errorsLane } from "./ingest-lane";
import { errorIngestService } from "./services/error-ingest.service";
import type { ErrorsModule } from "./interfaces";

/**
 * Build the errors module.
 *
 * No lifecycle hooks: this module is services and a lane, with no timer, browser or
 * socket of its own, so it is fully alive the moment it is composed.
 */
export function initErrorsModule(): ErrorsModule {
  return {
    lane: errorsLane(() => errorIngestService()),
    ingest: () => errorIngestService(),
    // Read and mutation surfaces arrive with the dashboard routes; the ingest half is
    // useful on its own, because data has to be accumulating before there is anything
    // worth showing.
    queries: {
      async listGroups() {
        throw new Error("not implemented");
      },
      async getGroup() {
        throw new Error("not implemented");
      },
    },
    mutations: {
      async setStatus() {
        throw new Error("not implemented");
      },
    },
  };
}
