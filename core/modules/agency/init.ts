import { env } from "../../config";
import type { EmbedLinks } from "../api-keys/interfaces";
import type { ClientDirectory, OwnedWebsites } from "../websites/interfaces";
import type { AgencyModule, SiteMetricSource, TrackingActivityReader } from "./interfaces";
import { PostgresAlertRepository } from "./repositories/alert.repository";
import { PostgresSetupSignalRepository } from "./repositories/setup-signal.repository";
import { PostgresWhiteLabelRepository } from "./repositories/white-label.repository";
import { AgencyOverviewService } from "./services/overview.service";
import { AgencySetupService } from "./services/setup.service";
import { WebsiteVerificationService } from "./services/verification.service";
import { WhiteLabelService } from "./services/white-label.service";
import { createAgencyRoutes } from "./routes";

/**
 * Build the agency module: the workspace API and the white label.
 *
 * Authentication and plan gating are not here: in managed Cloud the gateway decides who
 * may call the agency API and names the agency in headers (see `lib/gateway-context.ts`).
 */
export function initAgencyModule(deps: {
  clients: ClientDirectory;
  websites: OwnedWebsites;
  embedLinks: EmbedLinks;
  /** Each module's per-site figures for the overview. */
  metrics: readonly SiteMetricSource[];
  activity: TrackingActivityReader;
}): AgencyModule {
  const whiteLabel = new WhiteLabelService(new PostgresWhiteLabelRepository());
  const overview = new AgencyOverviewService({
    clients: deps.clients,
    websites: deps.websites,
    sources: deps.metrics,
    alerts: new PostgresAlertRepository(),
  });
  const setup = new AgencySetupService({
    whiteLabel,
    clients: deps.clients,
    websites: deps.websites,
    activity: deps.activity,
    signals: new PostgresSetupSignalRepository(),
  });
  const verification = new WebsiteVerificationService({ websites: deps.websites, activity: deps.activity });

  return {
    whiteLabel,
    routes: createAgencyRoutes({
      clients: deps.clients,
      websites: deps.websites,
      whiteLabel,
      overview,
      setup,
      verification,
      embedLinks: deps.embedLinks,
      urls: () => ({ scriptUrl: env().trackerScriptUrl, frontendUrl: env().frontendUrl }),
    }),
  };
}
