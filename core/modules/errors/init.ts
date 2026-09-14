import { errorsLane } from "./ingest-lane";
import { createErrorRoutes } from "./routes";
import { errorIngestService } from "./services/error-ingest.service";
import { ErrorMutationService, ErrorQueryService } from "./services/error-query.service";
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
    ingest: () => errorIngestService(),
    queries,
    mutations,
    routes: createErrorRoutes({
      queries,
      mutations,
      websites: deps.websitesModule.accessChecks,
    }),
  };
}
