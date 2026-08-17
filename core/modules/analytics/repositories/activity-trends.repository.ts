import { getDailyStatsAnalytics } from "./daily-stats.repository";

export async function getActivityTrendsStats(
  siteId: string,
  query: Record<string, string | undefined>,
) {
  return getDailyStatsAnalytics(siteId, query);
}
