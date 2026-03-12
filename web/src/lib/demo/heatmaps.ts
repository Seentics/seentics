/**
 * Demo data for heatmaps
 */

export const demoHeatmapPages = () => ([
  { url: '/', page_views: 184231, clicks: 42187, last_tracked: new Date().toISOString() },
  { url: '/features', page_views: 65432, clicks: 18765, last_tracked: new Date().toISOString() },
  { url: '/pricing', page_views: 42187, clicks: 15432, last_tracked: new Date().toISOString() },
  { url: '/docs/introduction', page_views: 34567, clicks: 9876, last_tracked: new Date().toISOString() },
  { url: '/blog/why-real-time-matters', page_views: 28432, clicks: 7654, last_tracked: new Date().toISOString() },
  { url: '/signup', page_views: 9876, clicks: 5432, last_tracked: new Date().toISOString() },
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
