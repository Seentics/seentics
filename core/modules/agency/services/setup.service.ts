import type { ClientDirectory, OwnedWebsites } from "../../websites/interfaces";
import type { AgencySetup, SetupSignalRepository, SetupStepId, TrackingActivityReader, WhiteLabel } from "../interfaces";
import { allClients } from "./overview.service";

/**
 * The setup guide's progress, read fresh each time: each step is a fact about the agency's
 * data, not a checkbox anyone ticks.
 *
 *   branding           the brand saved with a name, or a custom domain live at the gateway
 *   first_client       any client
 *   website_installed  any site whose tracker has been seen
 *   client_user        any client member (written by the gateway's invites, phase 2)
 *   features_limits    any client with a dashboard page switched on (limits arrive in phase 4)
 */
export class AgencySetupService implements AgencySetup {
  constructor(
    private readonly deps: {
      whiteLabel: Pick<WhiteLabel, "get">;
      clients: ClientDirectory;
      websites: OwnedWebsites;
      activity: TrackingActivityReader;
      signals: SetupSignalRepository;
    },
  ) {}

  async steps(ownerId: string): Promise<{ id: SetupStepId; done: boolean }[]> {
    const [brand, domain, clients, sites, member] = await Promise.all([
      this.deps.whiteLabel.get(ownerId),
      this.deps.signals.customDomain(ownerId),
      allClients(this.deps.clients, ownerId),
      this.deps.websites.allWebsites(ownerId),
      this.deps.signals.hasClientMember(ownerId),
    ]);

    let installed = sites.some((s) => s.isVerified);
    if (!installed && sites.length > 0) {
      const activity = await this.deps.activity.activity(sites.map((s) => s.id));
      installed = [...activity.values()].some((a) => a.lastEventAt !== null);
    }

    const done: Record<SetupStepId, boolean> = {
      branding: (brand.updatedAt !== null && brand.brandName !== "") || domain?.state === "active",
      first_client: clients.length > 0,
      website_installed: installed,
      client_user: member,
      features_limits: clients.some((c) => Object.values(c.dashboardFeatures).some((v) => v !== "off")),
    };
    return (Object.keys(done) as SetupStepId[]).map((id) => ({ id, done: done[id] }));
  }
}
