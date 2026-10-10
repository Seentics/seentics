import { describe, expect, it } from 'vitest';
import { demoAnalyticsData } from '@/lib/demo';
import { demoHeatmapPoints } from '@/lib/demo/heatmaps';
import { demoReplays } from '@/lib/demo/replays';
import { demoRevenueDashboard } from '@/lib/demo/revenue';

describe('demo fixtures', () => {
  it('returns identical analytics data for every invocation', () => {
    expect(demoAnalyticsData()).toEqual(demoAnalyticsData());
  });

  it('keeps visual fixture data stable for recordings', () => {
    expect(demoHeatmapPoints('click')).toEqual(demoHeatmapPoints('click'));
    expect(demoReplays()).toEqual(demoReplays());
    expect(demoRevenueDashboard(30)).toEqual(demoRevenueDashboard(30));
  });
});
