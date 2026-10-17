import { emptyTrafficSummary, type AnalyticsModule } from "../../analytics/interfaces";
import type {
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
   * The user's own websites, then the ones they were invited to. An invitee whose list held
   * only owned sites had the role but no way to find the site in the dashboard.
   */
  async listOwnedWithTraffic(ownerId: string): Promise<WebsiteWithTraffic[]> {
    const [owned, shared] = await Promise.all([this.repository.listOwnedBy(ownerId), this.repository.listMemberOf(ownerId)]);
    const websites = [...owned, ...shared];
    if (websites.length === 0) return [];
    const summaries = await this.analyticsModule().getTrafficSummary(websites.map((website) => website.id));
    return websites.map((website) => ({
      ...website,
      traffic: summaries.get(website.id) ?? emptyTrafficSummary(),
    }));
  }

  async getWithTraffic(websiteId: string): Promise<WebsiteWithTraffic | null> {
    const website = await this.repository.findById(websiteId);
    if (!website) return null;
    const summaries = await this.analyticsModule().getTrafficSummary([websiteId]);
    return { ...website, traffic: summaries.get(websiteId) ?? emptyTrafficSummary() };
  }
}
