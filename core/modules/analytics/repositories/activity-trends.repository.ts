import { getDailyStatsAnalytics } from "./daily-stats.repository";

export async function getActivityTrendsStats(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  return getDailyStatsAnalytics(websiteId, query);
}
