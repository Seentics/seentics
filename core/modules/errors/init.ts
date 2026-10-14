import { errorsLane } from "./ingest-lane";
import { createErrorRoutes } from "./routes";
import { errorIngestService } from "./services/error-ingest.service";
import { ErrorMutationService, ErrorQueryService } from "./services/error-query.service";
import { ErrorsRetentionPurge } from "./services/retention-purge.service";
import { errorSurgeCandidates } from "./repositories/error-reads.repository";
import type { WebsitesModule } from "../websites/interfaces";
import type { ErrorsModule } from "./interfaces";

/**
 * Build the errors module.
 *
 * No lifecycle hooks: services, routes and a lane, with no timer, browser or socket of
 * its own, so it is fully alive the moment it is composed.
 */
export function initErrorsModule(deps: { websitesModule: WebsitesModule }): ErrorsModule {
  const queries = new ErrorQueryService();
  const mutations = new ErrorMutationService();

  return {
    lane: errorsLane(() => errorIngestService()),
    retention: new ErrorsRetentionPurge(),
    ingest: () => errorIngestService(),
    queries,
    mutations,
    anomalyReads: { surgeCandidates: errorSurgeCandidates },
    routes: createErrorRoutes({
      queries,
      mutations,
      websites: deps.websitesModule.accessChecks,
    }),
  };
}
