import type { AutomationDirectory } from "../automations/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { LeadSink, LeadsModule } from "./interfaces";
import { createLeadRoutes } from "./routes";
import { createLeadTrackerRoutes } from "./tracker-routes";
import { LeadCaptureService } from "./services/lead-capture.service";
import { LeadsRetentionPurge } from "./services/retention-purge.service";
import { SubmissionMutationService } from "./services/submission-mutation.service";
import { SubmissionQueryService } from "./services/submission-query.service";
import { LeadUsageCounter } from "./services/usage-count.service";

/**
 * Build the leads module.
 *
 * No lifecycle hooks: services and routes only. It exposes two routers because it has two
 * audiences: the dashboard (authenticated, per-form submissions) and the popup form's submit
 * endpoint (anonymous, mounted under `/tracker` so it shares the tracker's gateway and
 * rate-limit treatment). Delivery is the `sink`'s job — the integrations module.
 */
export function initLeadsModule(deps: {
  websitesModule: WebsitesModule;
  automations: AutomationDirectory;
  sink: LeadSink;
}): LeadsModule {
  const capture = new LeadCaptureService(deps.automations, deps.sink);
  const queries = new SubmissionQueryService(deps.sink);
  const mutations = new SubmissionMutationService(deps.sink);

  return {
    capture,
    queries,
    mutations,
    usage: new LeadUsageCounter(),
    retention: new LeadsRetentionPurge(),
    routes: createLeadRoutes({ queries, mutations, websites: deps.websitesModule.accessChecks }),
    trackerRoutes: createLeadTrackerRoutes({ capture, trackerWebsites: deps.websitesModule.trackerWebsites }),
  };
}
