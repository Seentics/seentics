/**
 * Demo data for heatmaps
 */

export const demoHeatmapPages = () => ([
  { url: '/', views: 184231, clicks: 42187, avg_scroll: 72, active: true },
  { url: '/features', views: 65432, clicks: 18765, avg_scroll: 65, active: true },
  { url: '/pricing', views: 42187, clicks: 15432, avg_scroll: 80, active: true },
  { url: '/docs/introduction', views: 34567, clicks: 9876, avg_scroll: 55, active: true },
  { url: '/blog/why-real-time-matters', views: 28432, clicks: 7654, avg_scroll: 48, active: false },
  { url: '/signup', views: 9876, clicks: 5432, avg_scroll: 90, active: true },
]);

export const demoHeatmapPoints = (type: 'click' | 'move' = 'click') => {
  const count = type === 'click' ? 50 : 200;
  const points: Array<{ x: number; y: number; intensity: number }> = [];

  for (let i = 0; i < count; i++) {
    const centerX = Math.random() * 800 + 100;
    const centerY = Math.random() * 800 + 100;
    const clusterSize = Math.floor(Math.random() * 10) + 1;

    for (let j = 0; j < clusterSize; j++) {
      points.push({
        x: Math.round(centerX + (Math.random() - 0.5) * 50),
        y: Math.round(centerY + (Math.random() - 0.5) * 50),
        intensity: Math.floor(Math.random() * 20) + 1,
      });
    }
  }
  return points;
};
