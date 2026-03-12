/**
 * Demo data for session replays
 */

const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const devices = ['Desktop', 'Mobile', 'Tablet'];
const oses = ['Windows', 'macOS', 'iOS', 'Android'];
const countries = ['United States', 'Germany', 'United Kingdom', 'Canada', 'France'];
const pages = ['/', '/pricing', '/features', '/docs/introduction', '/blog/getting-started', '/signup', '/contact'];

export const demoReplays = () => ({
  sessions: Array.from({ length: 25 }, (_, i) => {
    const startTime = new Date(Date.now() - (i * 3600000 + Math.random() * 3600000));
    const duration = Math.floor(30 + Math.random() * 600);
    return {
      id: `demo-session-${i + 1}`,
      session_id: `demo-session-${i + 1}`,
      visitor_id: `visitor-${Math.floor(Math.random() * 1000)}`,
      website_id: 'demo',
      browser: browsers[Math.floor(Math.random() * browsers.length)],
      device: devices[Math.floor(Math.random() * devices.length)],
      os: oses[Math.floor(Math.random() * oses.length)],
      country: countries[Math.floor(Math.random() * countries.length)],
      entry_page: pages[Math.floor(Math.random() * pages.length)],
      exit_page: pages[Math.floor(Math.random() * pages.length)],
      pages_viewed: Math.floor(1 + Math.random() * 8),
      duration,
      start_time: startTime.toISOString(),
      end_time: new Date(startTime.getTime() + duration * 1000).toISOString(),
      created_at: startTime.toISOString(),
      events_count: Math.floor(5 + Math.random() * 50),
      has_errors: Math.random() > 0.8,
      has_rage_clicks: Math.random() > 0.85,
    };
  }),
  total: 25,
  has_more: false,
});

export const demoReplaySession = (sessionId: string) => ({
  id: sessionId,
  session_id: sessionId,
  visitor_id: 'visitor-demo-42',
  website_id: 'demo',
  browser: 'Chrome',
  device: 'Desktop',
  os: 'macOS',
  country: 'United States',
  entry_page: '/',
  exit_page: '/pricing',
  pages_viewed: 5,
  duration: 245,
  start_time: new Date(Date.now() - 300000).toISOString(),
  end_time: new Date(Date.now() - 55000).toISOString(),
  events_count: 32,
  has_errors: false,
  has_rage_clicks: false,
  events: [],
});
