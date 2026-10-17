import { emptyTrafficSummary, type AnalyticsModule } from "../../analytics/interfaces";
import type {
  Website,
  WebsiteRepository,
  WebsiteTrafficReads,
  WebsiteWithTraffic,
} from "../interfaces";

/** Website reads enriched with analytics traffic summaries. */
export class WebsiteTrafficService implements WebsiteTrafficReads {
  constructor(
    private readonly repository: WebsiteRepository,
    private readonly analyticsModule: () => AnalyticsModule,
  ) {}

  /**
   * The user's own websites, then the ones they were invited to, then the client sites they
   * reach through an agency. An invitee whose list held only owned sites had the role but no
   * way to find the site in the dashboard. A client user gets the last group alone, scoped to
   * the agency they signed in to.
   */
  async listForUserWithTraffic(userId: string, clientAgency: string | null): Promise<WebsiteWithTraffic[]> {
    const websites = clientAgency
      ? await this.repository.listClientSitesOf(userId, clientAgency)
      : await this.accountWebsites(userId);
    if (websites.length === 0) return [];
    const summaries = await this.analyticsModule().getTrafficSummary(websites.map((website) => website.id));
    return websites.map((website) => ({
      ...website,
      traffic: summaries.get(website.id) ?? emptyTrafficSummary(),
    }));
  }

  private async accountWebsites(userId: string): Promise<Website[]> {
    const [owned, shared, client] = await Promise.all([
      this.repository.listOwnedBy(userId),
      this.repository.listMemberOf(userId),
      this.repository.listClientSitesOf(userId, null),
    ]);
    const seen = new Set<string>();
    return [...owned, ...shared, ...client].filter((website) => !seen.has(website.id) && seen.add(website.id));
  }

  async getWithTraffic(websiteId: string): Promise<WebsiteWithTraffic | null> {
    const website = await this.repository.findById(websiteId);
    if (!website) return null;
    const summaries = await this.analyticsModule().getTrafficSummary([websiteId]);
    return { ...website, traffic: summaries.get(websiteId) ?? emptyTrafficSummary() };
  }
}
