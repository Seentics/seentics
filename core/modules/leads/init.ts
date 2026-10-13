import type { AutomationDirectory } from "../automations/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { LeadsModule } from "./interfaces";
import { createLeadRoutes } from "./routes";
import { createLeadTrackerRoutes } from "./tracker-routes";
import { LeadCaptureService } from "./services/lead-capture.service";
import { LeadMutationService, LeadQueryService } from "./services/lead-query.service";
import { LeadUsageCounter } from "./services/usage-count.service";

/**
 * Build the leads module.
 *
 * No lifecycle hooks: services and routes only. It exposes two routers because it has two
 * audiences: the dashboard inbox (authenticated) and the popup form's submit endpoint
 * (anonymous, mounted under `/tracker` so it shares the tracker's gateway and rate-limit
 * treatment).
 */
export function initLeadsModule(deps: { websitesModule: WebsitesModule; automations: AutomationDirectory }): LeadsModule {
  const capture = new LeadCaptureService(deps.automations);
  const queries = new LeadQueryService(deps.automations);
  const mutations = new LeadMutationService();

  return {
    capture,
    queries,
    mutations,
    usage: new LeadUsageCounter(),
    routes: createLeadRoutes({
      queries,
      mutations,
      websites: deps.websitesModule.accessChecks,
    }),
    trackerRoutes: createLeadTrackerRoutes({
      capture,
      trackerWebsites: deps.websitesModule.trackerWebsites,
    }),
  };
}
