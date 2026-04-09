/**
 * Demo data for analytics: dashboard, daily/hourly stats, top-X breakdowns, realtime, custom events
 */

const now = new Date();
const daysAgo = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

export const demoAnalyticsData = () => ({
  dashboardData: {
    total_visitors: 89432,
    unique_visitors: 89432,
    sessions: 142593,
    live_visitors: 432,
    page_views: 421876,
    session_duration: 312,
    bounce_rate: 34.2,
    comparison: {
      current_period: {
        total_visitors: 89432,
        unique_visitors: 89432,
        sessions: 142593,
        page_views: 421876,
        avg_session_time: 312,
        bounce_rate: 34.2,
      },
      previous_period: {
        total_visitors: 76432,
        unique_visitors: 76432,
        sessions: 121402,
        page_views: 365821,
        avg_session_time: 298,
        bounce_rate: 38.5,
      },
      visitor_change: 17.4,
      pageview_change: 15.3,
      session_change: 17.5,
      duration_change: 4.7,
      bounce_change: -11.2,
    },
  },

  dailyStats: {
    daily_stats: Array.from({ length: 30 }, (_, i) => ({
      date: daysAgo(29 - i),
      views: Math.floor(12000 + Math.random() * 4000 + Math.sin(i / 2) * 2000),
      unique: Math.floor(4000 + Math.random() * 1500 + Math.sin(i / 2) * 800),
      bounce_rate: 30 + Math.random() * 10,
      avg_session_duration: 280 + Math.random() * 60,
    })),
  },

  hourlyStats: {
    hourly_stats: Array.from({ length: 24 }, (_, hour) => {
      const curve = Math.sin((hour - 6) * Math.PI / 12) + 1;
      return {
        hour,
        timestamp: new Date(new Date().setHours(hour, 0, 0, 0)).toISOString(),
        views: Math.floor(400 + (curve * 800) + Math.random() * 200),
        unique: Math.floor(150 + (curve * 300) + Math.random() * 100),
        hour_label: `${hour.toString().padStart(2, '0')}:00`,
      };
    }),
  },

  topPages: {
    top_pages: [
      { page: '/', views: 184231, unique: 76432, avg_time: 124, bounce_rate: 32.4 },
      { page: '/features', views: 65432, unique: 42187, avg_time: 215, bounce_rate: 28.7 },
      { page: '/pricing', views: 42187, unique: 31543, avg_time: 198, bounce_rate: 41.2 },
      { page: '/docs/introduction', views: 34567, unique: 18432, avg_time: 432, bounce_rate: 18.5 },
      { page: '/blog/why-real-time-matters', views: 28432, unique: 21543, avg_time: 341, bounce_rate: 24.1 },
      { page: '/integrations', views: 21543, unique: 15432, avg_time: 167, bounce_rate: 35.8 },
      { page: '/about-us', views: 15432, unique: 12543, avg_time: 145, bounce_rate: 42.1 },
      { page: '/blog/cookie-free-analytics', views: 12543, unique: 9876, avg_time: 389, bounce_rate: 21.3 },
      { page: '/signup', views: 9876, unique: 8765, avg_time: 84, bounce_rate: 54.2 },
      { page: '/contact', views: 7654, unique: 5432, avg_time: 112, bounce_rate: 48.9 },
    ],
  },

  topReferrers: {
    top_referrers: [
      { referrer: 'google.com', views: 142593, unique: 89432 },
      { referrer: 'direct', views: 84321, unique: 52187 },
      { referrer: 't.co', views: 32154, unique: 21543 },
      { referrer: 'm.facebook.com', views: 28432, unique: 18432 },
      { referrer: 'github.com', views: 24567, unique: 15432 },
      { referrer: 'linkedin.com', views: 21543, unique: 13245 },
      { referrer: 'producthunt.com', views: 18432, unique: 12543 },
      { referrer: 'news.ycombinator.com', views: 12543, unique: 9876 },
      { referrer: 'reddit.com', views: 9876, unique: 7654 },
      { referrer: 'youtube.com', views: 7654, unique: 6543 },
    ],
  },

  topCountries: {
    top_countries: [
      { country: 'United States', views: 23456, unique: 18234 },
      { country: 'United Kingdom', views: 8765, unique: 6543 },
      { country: 'Canada', views: 5432, unique: 4321 },
      { country: 'Germany', views: 4321, unique: 3456 },
      { country: 'France', views: 3456, unique: 2765 },
      { country: 'India', views: 3210, unique: 2543 },
      { country: 'Australia', views: 2987, unique: 2345 },
      { country: 'Netherlands', views: 2345, unique: 1876 },
      { country: 'Spain', views: 1987, unique: 1654 },
      { country: 'Brazil', views: 1654, unique: 1432 },
    ],
  },

  topBrowsers: {
    top_browsers: [
      { browser: 'Chrome', views: 45678, unique: 32145 },
      { browser: 'Safari', views: 18234, unique: 12543 },
      { browser: 'Firefox', views: 9876, unique: 7654 },
      { browser: 'Edge', views: 6543, unique: 4987 },
      { browser: 'Opera', views: 2345, unique: 1876 },
      { browser: 'Brave', views: 1654, unique: 1234 },
      { browser: 'Samsung Internet', views: 987, unique: 765 },
    ],
  },

  topDevices: {
    top_devices: [
      { device: 'Desktop', views: 52341, unique: 38765 },
      { device: 'Mobile', views: 28765, unique: 19876 },
      { device: 'Tablet', views: 8128, unique: 5987 },
    ],
  },

  topOS: {
    top_os: [
      { os: 'Windows', views: 32145, unique: 23456 },
      { os: 'macOS', views: 18234, unique: 13245 },
      { os: 'iOS', views: 15678, unique: 11234 },
      { os: 'Android', views: 13245, unique: 9876 },
      { os: 'Linux', views: 6543, unique: 4987 },
      { os: 'Chrome OS', views: 2345, unique: 1765 },
    ],
  },

  topResolutions: {
    top_resolutions: [
      { name: '1920x1080', count: 4500, percentage: 45.0 },
      { name: '1366x768', count: 3200, percentage: 32.0 },
      { name: '375x812', count: 2800, percentage: 28.0 },
      { name: '1440x900', count: 2100, percentage: 21.0 },
      { name: '414x896', count: 1500, percentage: 15.0 },
    ],
  },

  topLanguages: {
    top_languages: [
      { name: 'en-US', count: 4500, percentage: 45.0 },
      { name: 'en-GB', count: 1200, percentage: 12.0 },
      { name: 'de-DE', count: 800, percentage: 8.0 },
      { name: 'fr-FR', count: 600, percentage: 6.0 },
      { name: 'es-ES', count: 500, percentage: 5.0 },
    ],
  },

  topCities: {
    top_cities: [
      { name: 'San Francisco', count: 2200, percentage: 22.0 },
      { name: 'New York', count: 1800, percentage: 18.0 },
      { name: 'London', count: 1200, percentage: 12.0 },
      { name: 'Berlin', count: 800, percentage: 8.0 },
      { name: 'Tokyo', count: 600, percentage: 6.0 },
    ],
  },

  visitorInsights: {
    visitor_insights: {
      new_visitors: 48432,
      returning_visitors: 41000,
      avg_session_duration: 312,
      new_vs_returning: {
        new_visitors: 48432,
        returning_visitors: 41000,
        new_percentage: 54.1,
        returning_percentage: 45.9,
      },
      engagement_metrics: {
        avg_pages_per_session: 4.2,
        avg_session_duration: 312,
        engaged_sessions: 62187,
        engagement_rate: 69.5,
      },
      top_entry_pages: [
        { page: '/', sessions: 52187, bounce_rate: 32.4 },
        { page: '/blog/why-real-time-matters', sessions: 12543, bounce_rate: 24.1 },
        { page: '/features', sessions: 8765, bounce_rate: 28.7 },
      ],
      top_exit_pages: [
        { page: '/signup', sessions: 9876, exit_rate: 64.2 },
        { page: '/pricing', sessions: 6543, exit_rate: 41.2 },
        { page: '/contact', sessions: 2345, exit_rate: 48.9 },
      ],
    },
  },

  activityTrends: {
    website_id: 'demo',
    trends: Array.from({ length: 24 }, (_, hour) => {
      const curve = Math.sin((hour - 6) * Math.PI / 12) + 1;
      const visitors = Math.floor(80 + (curve * 350) + Math.random() * 60);
      const pageViews = Math.floor(visitors * (2.5 + Math.random()));
      const sessions = Math.floor(visitors * 0.7);
      const ts = new Date();
      ts.setHours(hour, 0, 0, 0);
      return {
        timestamp: ts.toISOString(),
        visitors,
        page_views: pageViews,
        events: pageViews,
        sessions,
        engagement: sessions > 0 ? +(pageViews / sessions).toFixed(1) : 0,
        label: `${hour.toString().padStart(2, '0')}:00`,
      };
    }),
  },

  goalStats: {
    goals: [
      { id: 'g1', name: 'Signup Completed', goal_type: 'event', completions: 4876, conversion_rate: 12.4, unique_visitors: 3900, target: 'signup_complete' },
      { id: 'g2', name: 'Newsletter Subscribe', goal_type: 'event', completions: 8765, conversion_rate: 8.2, unique_visitors: 7200, target: 'newsletter_form' },
      { id: 'g3', name: 'Pricing Page Visit', goal_type: 'pageview', completions: 12543, conversion_rate: 24.1, unique_visitors: 9800, target: '/pricing' },
      { id: 'g4', name: 'Demo Video Watched', goal_type: 'click', completions: 6543, conversion_rate: 5.7, unique_visitors: 5100, target: '#demo-video' },
      { id: 'g5', name: 'Contact Form Submit', goal_type: 'event', completions: 2187, conversion_rate: 3.9, unique_visitors: 1800, target: 'contact_submit' },
    ],
  },

  retentionData: {
    website_id: 'demo',
    date_range: '30',
    day_1: 45.2,
    day_7: 22.8,
    day_30: 12.5,
    cohorts: [
      { week: 'Dec 25', size: 1200, retention: [100, 42, 35, 28, 22] },
      { week: 'Jan 01', size: 1500, retention: [100, 38, 30, 25] },
      { week: 'Jan 08', size: 1100, retention: [100, 45, 33] },
      { week: 'Jan 15', size: 1350, retention: [100, 40] },
      { week: 'Jan 22', size: 900, retention: [100] },
    ],
  },

  recentActivity: {
    activities: [
      { page: '/', country: 'United States', browser: 'Chrome', device: 'Desktop', os: 'macOS', referrer: 'https://google.com/', timestamp: new Date(Date.now() - 30000).toISOString() },
      { page: '/pricing', country: 'Germany', browser: 'Firefox', device: 'Desktop', os: 'Windows 10', referrer: '', timestamp: new Date(Date.now() - 60000).toISOString() },
      { page: '/signup', country: 'United Kingdom', browser: 'Safari', device: 'Mobile', os: 'iOS', referrer: 'https://twitter.com/', timestamp: new Date(Date.now() - 120000).toISOString() },
      { page: '/docs', country: 'Canada', browser: 'Chrome', device: 'Desktop', os: 'Linux', referrer: '', timestamp: new Date(Date.now() - 180000).toISOString() },
      { page: '/features', country: 'France', browser: 'Edge', device: 'Tablet', os: 'Android', referrer: 'https://news.ycombinator.com/', timestamp: new Date(Date.now() - 240000).toISOString() },
    ],
  },

  // Aliases used by the overview page
  get geolocationData() { return demoGeolocation(); },
  get customEvents() { return demoCustomEvents(); },
});

export const demoRealtimeData = () => {
  const timeline = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60000);
    timeline.push({
      minute: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      visitors: Math.floor(Math.random() * 8) + 1,
      views: Math.floor(Math.random() * 15) + 2,
    });
  }
  return {
    active_visitors: Math.floor(Math.random() * 30) + 15,
    pageviews: Math.floor(Math.random() * 100) + 40,
    sessions: Math.floor(Math.random() * 40) + 15,
    top_pages: [
      { page: '/', visitors: 12 },
      { page: '/pricing', visitors: 8 },
      { page: '/docs', visitors: 5 },
      { page: '/blog/getting-started', visitors: 3 },
      { page: '/features', visitors: 2 },
    ],
    top_referrers: [
      { name: 'google.com', visitors: 15 },
      { name: '(direct)', visitors: 10 },
      { name: 'twitter.com', visitors: 4 },
      { name: 'github.com', visitors: 3 },
    ],
    top_countries: [
      { name: 'United States', visitors: 12 },
      { name: 'Germany', visitors: 6 },
      { name: 'United Kingdom', visitors: 4 },
      { name: 'Canada', visitors: 3 },
      { name: 'France', visitors: 2 },
    ],
    top_devices: [
      { name: 'Desktop', visitors: 20 },
      { name: 'Mobile', visitors: 8 },
      { name: 'Tablet', visitors: 2 },
    ],
    top_browsers: [
      { name: 'Chrome', visitors: 18 },
      { name: 'Firefox', visitors: 6 },
      { name: 'Safari', visitors: 4 },
      { name: 'Edge', visitors: 2 },
    ],
    timeline,
  };
};

export const demoCustomEvents = () => ({
  timeseries: Array.from({ length: 30 }, (_, i) => ({
    date: daysAgo(29 - i),
    event_count: Math.floor(800 + Math.random() * 400 + Math.sin(i / 3) * 300),
  })),
  top_events: [
    { event_type: 'signup_click', count: 12543, unique_visitors: 9876, unique_users: 9876, unique_sessions: 9200, sample_properties: { page: '/signup' }, common_properties: {} },
    { event_type: 'newsletter_subscribe', count: 8765, unique_visitors: 7654, unique_users: 7654, unique_sessions: 7000, sample_properties: { form: 'footer' }, common_properties: {} },
    { event_type: 'demo_video_watch', count: 6543, unique_visitors: 5432, unique_users: 5432, unique_sessions: 5000, sample_properties: { video_id: 'product-demo' }, common_properties: {} },
    { event_type: 'document_download', count: 4321, unique_visitors: 3210, unique_users: 3210, unique_sessions: 3000, sample_properties: { doc: 'whitepaper.pdf' }, common_properties: {} },
    { event_type: 'plan_upgrade', count: 1876, unique_visitors: 1876, unique_users: 1876, unique_sessions: 1876, sample_properties: { plan: 'pro' }, common_properties: {} },
  ],
  utm_performance: {
    sources: [
      { source: 'google', unique_visitors: 42187, visits: 85432 },
      { source: 'twitter', unique_visitors: 21543, visits: 42187 },
      { source: 'facebook', unique_visitors: 18432, visits: 34567 },
      { source: 'newsletter', unique_visitors: 15432, visits: 28432 },
      { source: 'linkedin', unique_visitors: 12543, visits: 21543 },
    ],
    mediums: [
      { medium: 'organic', unique_visitors: 52187, visits: 98765 },
      { medium: 'cpc', unique_visitors: 34567, visits: 65432 },
      { medium: 'social', unique_visitors: 28432, visits: 54321 },
      { medium: 'email', unique_visitors: 15432, visits: 28432 },
      { medium: 'referral', unique_visitors: 12543, visits: 21543 },
    ],
    campaigns: [
      { campaign: 'q1_growth', unique_visitors: 24567, visits: 48432 },
      { campaign: 'product_hunt_launch', unique_visitors: 18432, visits: 32154 },
      { campaign: 'black_friday_2025', unique_visitors: 15432, visits: 28432 },
      { campaign: 'retargeting_global', unique_visitors: 12543, visits: 21543 },
    ],
    terms: [
      { term: 'best website analytics', unique_visitors: 8432, visits: 15432 },
      { term: 'privacy first analytics', unique_visitors: 6543, visits: 12543 },
      { term: 'real time user tracking', unique_visitors: 5432, visits: 9876 },
    ],
    content: [
      { content: 'hero_cta_button', unique_visitors: 12543, visits: 24567 },
      { content: 'footer_link', unique_visitors: 4321, visits: 8765 },
      { content: 'sidebar_banner', unique_visitors: 2154, visits: 4321 },
    ],
    avg_ctr: 5.2,
    total_campaigns: 4,
    total_sources: 5,
    total_mediums: 5,
  },
});

export const demoGeolocation = () => ({
  countries: [
    { name: 'United States', count: 18234, percentage: 40.2 },
    { name: 'United Kingdom', count: 6543, percentage: 14.4 },
    { name: 'Canada', count: 4321, percentage: 9.5 },
    { name: 'Germany', count: 3456, percentage: 7.6 },
    { name: 'France', count: 2765, percentage: 6.1 },
    { name: 'India', count: 2543, percentage: 5.6 },
    { name: 'Australia', count: 2345, percentage: 5.2 },
    { name: 'Netherlands', count: 1876, percentage: 4.1 },
    { name: 'Spain', count: 1654, percentage: 3.6 },
    { name: 'Brazil', count: 1432, percentage: 3.2 },
  ],
  continents: [
    { name: 'North America', count: 27898, percentage: 61.5 },
    { name: 'Europe', count: 12096, percentage: 26.7 },
    { name: 'Asia', count: 3210, percentage: 7.1 },
    { name: 'Oceania', count: 2345, percentage: 5.2 },
  ],
  regions: [
    { name: 'California', count: 8234, percentage: 18.1 },
    { name: 'New York', count: 5432, percentage: 12.0 },
    { name: 'London', count: 4321, percentage: 9.5 },
    { name: 'Ontario', count: 3456, percentage: 7.6 },
  ],
  cities: [
    { name: 'New York', count: 5432, percentage: 12.0 },
    { name: 'London', count: 4321, percentage: 9.5 },
    { name: 'Los Angeles', count: 3456, percentage: 7.6 },
    { name: 'Toronto', count: 2876, percentage: 6.3 },
    { name: 'San Francisco', count: 2543, percentage: 5.6 },
  ],
});
