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
            total_visitors: 45678,
            unique_visitors: 32145,
            live_visitors: 127,
            page_views: 89234,
            session_duration: 245, // seconds
            bounce_rate: 42.5,
            comparison: {
                visitor_change: 40602, // Previous period value for Total Visitors (+12.5%)
                pageview_change: 77125, // Previous period value for Page Views (+15.7%)
                duration_change: 253, // Previous period value for Session Duration (-3.2%)
                bounce_change: 44.8, // Previous value for Bounce Rate (so current 42.5 is improvement)
                // unique_visitors comparison is not used in UI
            },
        },

        // Daily stats for traffic chart
        dailyStats: {
            daily_stats: Array.from({ length: 30 }, (_, i) => ({
                date: daysAgo(29 - i),
                views: Math.floor(2500 + Math.random() * 1000 + Math.sin(i / 3) * 500),
                unique: Math.floor(800 + Math.random() * 400 + Math.sin(i / 3) * 200),
                bounce_rate: 35 + Math.random() * 20,
                avg_session_duration: 180 + Math.random() * 120,
            })),
        },

        // Hourly stats
        hourlyStats: {
            hourly_stats: Array.from({ length: 24 }, (_, hour) => ({
                hour,
                timestamp: new Date(now.setHours(hour, 0, 0, 0)).toISOString(),
                views: Math.floor(150 + Math.random() * 250 + Math.sin(hour / 4) * 100),
                unique: Math.floor(50 + Math.random() * 100 + Math.sin(hour / 4) * 50),
                hour_label: `${hour.toString().padStart(2, '0')}:00`,
            })),
        },

        // Top pages
        topPages: {
            top_pages: [
                { page: '/', views: 12543, unique: 8234, avg_time: 145, bounce_rate: 38.5 },
                { page: '/products', views: 8932, unique: 6123, avg_time: 234, bounce_rate: 32.1 },
                { page: '/pricing', views: 6754, unique: 4892, avg_time: 189, bounce_rate: 45.3 },
                { page: '/blog', views: 5621, unique: 4123, avg_time: 312, bounce_rate: 28.7 },
                { page: '/about', views: 4532, unique: 3421, avg_time: 156, bounce_rate: 41.2 },
                { page: '/contact', views: 3421, unique: 2654, avg_time: 98, bounce_rate: 52.3 },
                { page: '/features', views: 2987, unique: 2134, avg_time: 201, bounce_rate: 36.8 },
                { page: '/docs', views: 2543, unique: 1876, avg_time: 423, bounce_rate: 22.4 },
                { page: '/blog/getting-started', views: 2134, unique: 1654, avg_time: 387, bounce_rate: 25.6 },
                { page: '/signup', views: 1876, unique: 1543, avg_time: 67, bounce_rate: 58.9 },
            ],
        },

        // Top referrers
        topReferrers: {
            top_referrers: [
                { referrer: 'Google', views: 15234, unique: 12345 },
                { referrer: 'Direct', views: 9876, unique: 7654 },
                { referrer: 'Facebook', views: 6543, unique: 5432 },
                { referrer: 'Twitter', views: 4321, unique: 3456 },
                { referrer: 'LinkedIn', views: 3456, unique: 2876 },
                { referrer: 'GitHub', views: 2987, unique: 2345 },
                { referrer: 'Product Hunt', views: 2345, unique: 1987 },
                { referrer: 'Hacker News', views: 1987, unique: 1654 },
                { referrer: 'Reddit', views: 1654, unique: 1432 },
                { referrer: 'Medium', views: 1234, unique: 1098 },
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
                event_count: Math.floor(100 + Math.random() * 200),
            })),
            top_events: [
                { event_type: 'button_click', count: 5432, unique_users: 3456 },
                { event_type: 'form_submit', count: 3456, unique_users: 2876 },
                { event_type: 'video_play', count: 2987, unique_users: 2345 },
                { event_type: 'download', count: 2345, unique_users: 1987 },
                { event_type: 'signup_complete', count: 1876, unique_users: 1876 },
            ],
            utm_performance: {
                sources: [
                    { source: 'google', unique_visitors: 8234, visits: 15432 },
                    { source: 'facebook', unique_visitors: 5432, visits: 9876 },
                    { source: 'twitter', unique_visitors: 3456, visits: 6543 },
                    { source: 'linkedin', unique_visitors: 2876, visits: 5432 },
                    { source: 'direct', unique_visitors: 2345, visits: 4321 },
                ],
                mediums: [
                    { medium: 'cpc', unique_visitors: 9876, visits: 18234 },
                    { medium: 'organic', unique_visitors: 7654, visits: 14321 },
                    { medium: 'social', unique_visitors: 5432, visits: 10234 },
                    { medium: 'email', unique_visitors: 3456, visits: 6543 },
                    { medium: 'referral', unique_visitors: 2345, visits: 4321 },
                ],
                campaigns: [
                    { campaign: 'summer_sale', unique_visitors: 6543, visits: 12345 },
                    { campaign: 'product_launch', unique_visitors: 5432, visits: 10234 },
                    { campaign: 'brand_awareness', unique_visitors: 4321, visits: 8234 },
                    { campaign: 'retargeting', unique_visitors: 3456, visits: 6543 },
                ],
                terms: [
                    { term: 'analytics tool', unique_visitors: 2345, visits: 4321 },
                    { term: 'web analytics', unique_visitors: 1987, visits: 3456 },
                    { term: 'website tracking', unique_visitors: 1654, visits: 2987 },
                ],
                content: [
                    { content: 'banner_ad', unique_visitors: 3456, visits: 6543 },
                    { content: 'text_ad', unique_visitors: 2876, visits: 5432 },
                    { content: 'video_ad', unique_visitors: 2345, visits: 4321 },
                ],
                avg_ctr: 4.8,
                total_campaigns: 4,
                total_sources: 5,
                total_mediums: 5,
            },
        },

        // Visitor insights
        visitorInsights: {
            visitor_insights: {
                new_visitors: 24567,
                returning_visitors: 21111,
                avg_session_duration: 245,
                new_vs_returning: {
                    new_visitors: 24567,
                    returning_visitors: 21111,
                    new_percentage: 53.8,
                    returning_percentage: 46.2,
                },
                engagement_metrics: {
                    avg_pages_per_session: 3.8,
                    avg_session_duration: 245,
                    engaged_sessions: 28765,
                    engagement_rate: 63.2,
                },
                top_entry_pages: [
                    { page: '/', sessions: 18234, bounce_rate: 38.5 },
                    { page: '/products', sessions: 6543, bounce_rate: 32.1 },
                    { page: '/blog', sessions: 4321, bounce_rate: 28.7 },
                ],
                top_exit_pages: [
                    { page: '/checkout', sessions: 5432, exit_rate: 78.9 },
                    { page: '/contact', sessions: 3456, exit_rate: 65.4 },
                    { page: '/pricing', sessions: 2987, exit_rate: 52.3 },
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
                name: 'Landing to Signup',
                isActive: true,
                steps: [
                    { name: 'Landing Page', event_type: 'pageview', properties: { page: '/' } },
                    { name: 'Pricing Page', event_type: 'pageview', properties: { page: '/pricing' } },
                    { name: 'Signup Page', event_type: 'pageview', properties: { page: '/signup' } },
                    { name: 'Complete', event_type: 'signup_complete' }
                ],
                stats: {
                    totalEntries: 15432,
                    totalCompletions: 1876,
                    conversionRate: 12.2,
                    stepStats: [
                        { step: 1, count: 15432, dropoff: 0, conversion: 100 },
                        { step: 2, count: 8765, dropoff: 6667, conversion: 56.8 },
                        { step: 3, count: 2345, dropoff: 6420, conversion: 15.2 },
                        { step: 4, count: 1876, dropoff: 469, conversion: 12.2 }
                    ]
                }
            },
            {
                id: 'demo-funnel-2',
                name: 'Blog to Product',
                isActive: true,
                steps: [
                    { name: 'Blog Page', event_type: 'pageview', properties: { page: '/blog' } },
                    { name: 'Product Page', event_type: 'pageview', properties: { page: '/products' } },
                    { name: 'Checkout Page', event_type: 'pageview', properties: { page: '/checkout' } }
                ],
                stats: {
                    totalEntries: 5621,
                    totalCompletions: 432,
                    conversionRate: 7.7,
                    stepStats: [
                        { step: 1, count: 5621, dropoff: 0, conversion: 100 },
                        { step: 2, count: 1234, dropoff: 4387, conversion: 22.0 },
                        { step: 3, count: 432, dropoff: 802, conversion: 7.7 }
                    ]
                }
            }
        ],

        // Automations data
        automations: [
            {
                id: 'demo-auto-1',
                name: 'Welcome Email',
                isActive: true,
                trigger: { type: 'event', event: 'signup_complete' },
                actions: [{ type: 'email', template: 'welcome' }],
                stats: {
                    triggeredCount: 1876,
                    successCount: 1874,
                    lastTriggered: new Date().toISOString()
                }
            },
            {
                id: 'demo-auto-2',
                name: 'Slack Notification',
                isActive: true,
                trigger: { type: 'event', event: 'payment_received' },
                actions: [{ type: 'slack', channel: '#sales' }],
                stats: {
                    triggeredCount: 432,
                    successCount: 432,
                    lastTriggered: new Date().toISOString()
                }
            }
        ],
    };
};

// Demo website data
export const getDemoWebsite = () => ({
    id: 'demo',
    name: 'Demo Website',
    url: 'https://demo.example.com',
    userId: 'demo-user',
    siteId: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isVerified: true,
    isActive: true,
    verificationToken: '',
    settings: {
        allowedOrigins: ['*'],
        trackingEnabled: true,
        dataRetentionDays: 365,
        useIpAnonymization: false,
        respectDoNotTrack: false,
        allowRawDataExport: false
    },
    stats: {
        totalPageviews: 89234,
        uniqueVisitors: 32145,
        averageSessionDuration: 245,
        bounceRate: 42.5,
    },
});
