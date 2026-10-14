/**
 * Demo data for heatmaps
 */
import { createDemoRandom } from './fixture-utils';

export const demoHeatmapPages = () => ([
  { url: '/', views: 184231, clicks: 42187, avg_scroll: 72, active: true, dead_click_pct: 8, reach_half_pct: 71, mobile_avg_scroll: 61, desktop_avg_scroll: 77 },
  { url: '/features', views: 65432, clicks: 18765, avg_scroll: 65, active: true, dead_click_pct: 12, reach_half_pct: 63, mobile_avg_scroll: 39, desktop_avg_scroll: 72 },
  { url: '/pricing', views: 42187, clicks: 15432, avg_scroll: 58, active: true, dead_click_pct: 32, reach_half_pct: 61, mobile_avg_scroll: 31, desktop_avg_scroll: 64 },
  { url: '/docs/introduction', views: 34567, clicks: 9876, avg_scroll: 55, active: true, dead_click_pct: 6, reach_half_pct: 54, mobile_avg_scroll: 49, desktop_avg_scroll: 58 },
  { url: '/blog/why-real-time-matters', views: 28432, clicks: 7654, avg_scroll: 41, active: false, dead_click_pct: 4, reach_half_pct: 38, mobile_avg_scroll: 36, desktop_avg_scroll: 45 },
  { url: '/signup', views: 9876, clicks: 5432, avg_scroll: 90, active: true, dead_click_pct: 3, reach_half_pct: 92, mobile_avg_scroll: 88, desktop_avg_scroll: 91 },
]);

export const demoHeatmapPoints = (type: 'click' | 'move' = 'click') => {
  const random = createDemoRandom(`heatmap-${type}`);
  const count = type === 'click' ? 50 : 200;
  const points: Array<{ x: number; y: number; intensity: number }> = [];

  for (let i = 0; i < count; i++) {
    const centerX = random() * 800 + 100;
    const centerY = random() * 800 + 100;
    const clusterSize = Math.floor(random() * 10) + 1;

    for (let j = 0; j < clusterSize; j++) {
      points.push({
        x: Math.round(centerX + (random() - 0.5) * 50),
        y: Math.round(centerY + (random() - 0.5) * 50),
        intensity: Math.floor(random() * 20) + 1,
      });
    }
  }
  return points;
};
