import { getDailyStatsAnalytics } from "./daily-stats";

export async function getActivityTrendsStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  return getDailyStatsAnalytics(websiteParam, query);
}
