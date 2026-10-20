import { randomUUID } from "node:crypto";
import type { TrafficChannelClassifier } from "../analytics/interfaces";
import type { AutomationDirectory } from "../automations/interfaces";
import type { RecordingPresence } from "../recordings/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { LeadSink, LeadsModule } from "./interfaces";
import { createLeadRoutes } from "./routes";
import { createLeadTrackerRoutes } from "./tracker-routes";
import { LeadCaptureService } from "./services/lead-capture.service";
import { LeadsRetentionPurge } from "./services/retention-purge.service";
import { SubmissionMutationService } from "./services/submission-mutation.service";
import { SubmissionQueryService } from "./services/submission-query.service";
import { LeadUsageCounter } from "./services/usage-count.service";
import { LeadSiteMetrics } from "./services/agency-site-metrics.service";
import { SiteLeadService } from "./services/site-lead.service";
import { ContactMutationService } from "./services/contact-mutation.service";

/**
 * Build the leads module.
 *
 * No lifecycle hooks: services and routes only. It exposes two routers because it has two
 * audiences: the dashboard (authenticated: each form's submissions, the site-wide inbox and
 * contacts) and the popup form's submit
 * endpoint (anonymous, mounted under `/tracker` so it shares the tracker's gateway and
 * rate-limit treatment). Delivery is the `sink`'s job — the integrations module.
 */
export function initLeadsModule(deps: {
  websitesModule: WebsitesModule;
  automations: AutomationDirectory;
  sink: LeadSink;
  /** Whether a submission's session was recorded, for "watch" in the inbox. */
  recordings: RecordingPresence;
  /** Where a submission or contact came from, by the dashboard's channel rules. */
  channels: TrafficChannelClassifier;
}): LeadsModule {
  const capture = new LeadCaptureService(deps.automations, deps.sink, randomUUID, deps.channels);
  const queries = new SubmissionQueryService(deps.sink);
  const mutations = new SubmissionMutationService(deps.sink);
  const site = new SiteLeadService({ automations: deps.automations, recordings: deps.recordings, channels: deps.channels, sink: deps.sink });
  const contacts = new ContactMutationService(deps.sink, (websiteId, id) => site.contactOnly(websiteId, id));

  return {
    capture,
    queries,
    mutations,
    site,
    contacts,
    usage: new LeadUsageCounter(),
    agencyMetrics: new LeadSiteMetrics(),
    retention: new LeadsRetentionPurge(),
    routes: createLeadRoutes({ queries, mutations, site, contacts, websites: deps.websitesModule.accessChecks }),
    trackerRoutes: createLeadTrackerRoutes({ capture, trackerWebsites: deps.websitesModule.trackerWebsites }),
  };
}
