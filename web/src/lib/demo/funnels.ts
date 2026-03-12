/**
 * Demo data for funnels
 */

export const demoFunnels = () => ({
  funnels: [
    {
      id: 'demo-funnel-1',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'Main Conversion Path',
      description: 'Homepage to signup flow',
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        { id: 'step-1', funnelId: 'demo-funnel-1', name: 'Home Page', order: 1, stepType: 'page_view' as const, pagePath: '/', matchType: 'exact' as const },
        { id: 'step-2', funnelId: 'demo-funnel-1', name: 'Feature Explore', order: 2, stepType: 'page_view' as const, pagePath: '/features', matchType: 'exact' as const },
        { id: 'step-3', funnelId: 'demo-funnel-1', name: 'Pricing View', order: 3, stepType: 'page_view' as const, pagePath: '/pricing', matchType: 'exact' as const },
        { id: 'step-4', funnelId: 'demo-funnel-1', name: 'Signup Start', order: 4, stepType: 'page_view' as const, pagePath: '/signup', matchType: 'exact' as const },
        { id: 'step-5', funnelId: 'demo-funnel-1', name: 'Conversion', order: 5, stepType: 'event' as const, eventType: 'signup_complete' },
      ],
      stats: {
        totalEntries: 85432,
        completions: 4876,
        conversionRate: 5.7,
        stepBreakdown: [
          { stepOrder: 1, stepName: 'Home Page', count: 85432, dropoffCount: 0, dropoffRate: 0, conversionRate: 100 },
          { stepOrder: 2, stepName: 'Feature Explore', count: 42187, dropoffCount: 43245, dropoffRate: 50.6, conversionRate: 49.3 },
          { stepOrder: 3, stepName: 'Pricing View', count: 18432, dropoffCount: 23755, dropoffRate: 56.3, conversionRate: 21.5 },
          { stepOrder: 4, stepName: 'Signup Start', count: 9876, dropoffCount: 8556, dropoffRate: 46.4, conversionRate: 11.5 },
          { stepOrder: 5, stepName: 'Conversion', count: 4876, dropoffCount: 5000, dropoffRate: 50.6, conversionRate: 5.7 },
        ],
      },
    },
    {
      id: 'demo-funnel-2',
      websiteId: 'demo',
      userId: 'demo-user',
      name: 'Blog Reader Engagement',
      description: 'Blog to docs conversion',
      isActive: true,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [
        { id: 'step-6', funnelId: 'demo-funnel-2', name: 'Blog Index', order: 1, stepType: 'page_view' as const, pagePath: '/blog', matchType: 'exact' as const },
        { id: 'step-7', funnelId: 'demo-funnel-2', name: 'Article Read', order: 2, stepType: 'page_view' as const, pagePath: '/blog/', matchType: 'starts_with' as const },
        { id: 'step-8', funnelId: 'demo-funnel-2', name: 'Docs View', order: 3, stepType: 'page_view' as const, pagePath: '/docs/', matchType: 'starts_with' as const },
      ],
      stats: {
        totalEntries: 34567,
        completions: 4231,
        conversionRate: 12.2,
        stepBreakdown: [
          { stepOrder: 1, stepName: 'Blog Index', count: 34567, dropoffCount: 0, dropoffRate: 0, conversionRate: 100 },
          { stepOrder: 2, stepName: 'Article Read', count: 15432, dropoffCount: 19135, dropoffRate: 55.3, conversionRate: 44.6 },
          { stepOrder: 3, stepName: 'Docs View', count: 4231, dropoffCount: 11201, dropoffRate: 72.5, conversionRate: 12.2 },
        ],
      },
    },
  ],
  total: 2,
});

export const demoFunnelStats = () => ({
  totalEntries: 85432,
  completions: 4876,
  conversionRate: 5.7,
  stepBreakdown: [
    { stepOrder: 1, stepName: 'Home Page', count: 85432, dropoffCount: 0, dropoffRate: 0, conversionRate: 100 },
    { stepOrder: 2, stepName: 'Feature Explore', count: 42187, dropoffCount: 43245, dropoffRate: 50.6, conversionRate: 49.3 },
    { stepOrder: 3, stepName: 'Pricing View', count: 18432, dropoffCount: 23755, dropoffRate: 56.3, conversionRate: 21.5 },
    { stepOrder: 4, stepName: 'Signup Start', count: 9876, dropoffCount: 8556, dropoffRate: 46.4, conversionRate: 11.5 },
    { stepOrder: 5, stepName: 'Conversion', count: 4876, dropoffCount: 5000, dropoffRate: 50.6, conversionRate: 5.7 },
  ],
});
