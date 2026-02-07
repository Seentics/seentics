/**
 * Demo data generator for the analytics dashboard
 * Used when websiteId is 'demo' to show sample data
 */

export const getDemoData = () => {
    const now = new Date();
    const daysAgo = (days: number) => {
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    };

    return {
        // Dashboard summary data
        dashboardData: {
            total_visitors: 142593,
            unique_visitors: 89432,
            live_visitors: 432,
            page_views: 421876,
            session_duration: 312, // seconds
            bounce_rate: 34.2,
            comparison: {
                previous_period: {
                    total_visitors: 121402,
                    unique_visitors: 76432,
                    page_views: 365821,
                    avg_session_time: 298,
                    bounce_rate: 38.5,
                },
                visitor_change: 17.4, 
                pageview_change: 15.3, 
                duration_change: 4.7, 
                bounce_change: -11.2, 
            },
        },

        // Daily stats for traffic chart
        dailyStats: {
            daily_stats: Array.from({ length: 30 }, (_, i) => ({
                date: daysAgo(29 - i),
                views: Math.floor(12000 + Math.random() * 4000 + Math.sin(i / 2) * 2000),
                unique: Math.floor(4000 + Math.random() * 1500 + Math.sin(i / 2) * 800),
                bounce_rate: 30 + Math.random() * 10,
                avg_session_duration: 280 + Math.random() * 60,
            })),
        },

        // Hourly stats
        hourlyStats: {
            hourly_stats: Array.from({ length: 24 }, (_, hour) => {
                // More realistic traffic curve (lower at night, peak in afternoon)
                const curve = Math.sin((hour - 6) * Math.PI / 12) + 1; // 0 to 2 curve
                return {
                    hour,
                    timestamp: new Date(now.setHours(hour, 0, 0, 0)).toISOString(),
                    views: Math.floor(400 + (curve * 800) + Math.random() * 200),
                    unique: Math.floor(150 + (curve * 300) + Math.random() * 100),
                    hour_label: `${hour.toString().padStart(2, '0')}:00`,
                };
            }),
        },

        // Top pages
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

        // Top referrers
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

        // Top countries
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

        // Top browsers
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

        // Top devices
        topDevices: {
            top_devices: [
                { device: 'Desktop', views: 52341, unique: 38765 },
                { device: 'Mobile', views: 28765, unique: 19876 },
                { device: 'Tablet', views: 8128, unique: 5987 },
            ],
        },

        // Top OS
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

        // Geolocation data
        geolocationData: {
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
        },

        // Custom events
        customEvents: {
            timeseries: Array.from({ length: 30 }, (_, i) => ({
                date: daysAgo(29 - i),
                event_count: Math.floor(800 + Math.random() * 400 + Math.sin(i / 3) * 300),
            })),
            top_events: [
                { event_type: 'signup_click', count: 12543, unique_users: 9876 },
                { event_type: 'newsletter_subscribe', count: 8765, unique_users: 7654 },
                { event_type: 'demo_video_watch', count: 6543, unique_users: 5432 },
                { event_type: 'document_download', count: 4321, unique_users: 3210 },
                { event_type: 'plan_upgrade', count: 1876, unique_users: 1876 },
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
        },

        // Visitor insights
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

        // Activity trends
        activityTrends: {
            trends: {
                hourly_pattern: Array.from({ length: 24 }, (_, hour) => ({
                    hour,
                    avg_visitors: Math.floor(50 + Math.random() * 100 + Math.sin(hour / 4) * 50),
                })),
                daily_pattern: [
                    { day: 'Monday', avg_visitors: 1234 },
                    { day: 'Tuesday', avg_visitors: 1345 },
                    { day: 'Wednesday', avg_visitors: 1456 },
                    { day: 'Thursday', avg_visitors: 1543 },
                    { day: 'Friday', avg_visitors: 1432 },
                    { day: 'Saturday', avg_visitors: 987 },
                    { day: 'Sunday', avg_visitors: 876 },
                ],
            },
        },

        // Retention data
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
            ]
        },

        // Funnels data
        funnels: [
            {
                id: 'demo-funnel-1',
                name: 'Main Conversion Path',
                isActive: true,
                steps: [
                    { name: 'Home Page', event_type: 'pageview', properties: { page: '/' } },
                    { name: 'Feature Explore', event_type: 'pageview', properties: { page: '/features' } },
                    { name: 'Pricing View', event_type: 'pageview', properties: { page: '/pricing' } },
                    { name: 'Signup Start', event_type: 'pageview', properties: { page: '/signup' } },
                    { name: 'Conversion', event_type: 'signup_complete' }
                ],
                stats: {
                    totalEntries: 85432,
                    totalCompletions: 4876,
                    conversionRate: 5.7,
                    stepStats: [
                        { step: 1, count: 85432, dropoff: 0, conversion: 100 },
                        { step: 2, count: 42187, dropoff: 43245, conversion: 49.3 },
                        { step: 3, count: 18432, dropoff: 23755, conversion: 21.5 },
                        { step: 4, count: 9876, dropoff: 8556, conversion: 11.5 },
                        { step: 5, count: 4876, dropoff: 5000, conversion: 5.7 }
                    ]
                }
            },
            {
                id: 'demo-funnel-2',
                name: 'Blog Reader Engagement',
                isActive: true,
                steps: [
                    { name: 'Blog Index', event_type: 'pageview', properties: { page: '/blog' } },
                    { name: 'Article Read', event_type: 'pageview', properties: { page: '/blog/*' } },
                    { name: 'Documentation View', event_type: 'pageview', properties: { page: '/docs/*' } }
                ],
                stats: {
                    totalEntries: 34567,
                    totalCompletions: 4231,
                    conversionRate: 12.2,
                    stepStats: [
                        { step: 1, count: 34567, dropoff: 0, conversion: 100 },
                        { step: 2, count: 15432, dropoff: 19135, conversion: 44.6 },
                        { step: 3, count: 4231, dropoff: 11201, conversion: 12.2 }
                    ]
                }
            }
        ],

        // Automations data
        automations: [
            {
                id: 'demo-auto-1',
                name: 'Post-Signup Onboarding',
                isActive: true,
                trigger: { type: 'event', event: 'signup_complete' },
                actions: [{ type: 'email', template: 'welcome_series_1' }],
                stats: {
                    triggeredCount: 4876,
                    successCount: 4874,
                    lastTriggered: new Date().toISOString()
                }
            },
            {
                id: 'demo-auto-2',
                name: 'High-Value Lead Alert',
                isActive: true,
                trigger: { type: 'event', event: 'pricing_view' },
                actions: [{ type: 'slack', channel: '#growth-alerts' }],
                stats: {
                    triggeredCount: 18432,
                    successCount: 18432,
                    lastTriggered: new Date().toISOString()
                }
            },
            {
                id: 'demo-auto-3',
                name: 'Retention Recovery',
                isActive: true,
                trigger: { type: 'event', event: 'session_start_after_7d' },
                actions: [{ type: 'webhook', url: 'https://api.crm.com/v1/update' }],
                stats: {
                    triggeredCount: 843,
                    successCount: 841,
                    lastTriggered: new Date().toISOString()
                }
            }
        ],
    };
};

// Demo website data
export const getDemoWebsite = () => ({
    id: 'demo',
    name: 'Seentics Production',
    url: 'https://seentics.com',
    userId: 'demo-user',
    siteId: 'production-demo',
    createdAt: new Date(2025, 0, 1).toISOString(),
    updatedAt: new Date().toISOString(),
    isVerified: true,
    isActive: true,
    automationEnabled: true,
    funnelEnabled: true,
    heatmapEnabled: true,
    verificationToken: '',
    settings: {
        allowedOrigins: ['*'],
        trackingEnabled: true,
        dataRetentionDays: 365,
        useIpAnonymization: true,
        respectDoNotTrack: true,
        allowRawDataExport: true
    },
    stats: {
        totalPageviews: 421876,
        uniqueVisitors: 89432,
        averageSessionDuration: 312,
        bounceRate: 34.2,
    },
});
