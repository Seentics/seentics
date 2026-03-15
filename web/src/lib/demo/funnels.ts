/**
 * Demo data for funnels
 * Uses snake_case to match the Funnel type from analytics-api.ts
 */

export const demoFunnels = () => ({
  funnels: [
    {
      id: 'demo-funnel-1',
      website_id: 'demo',
      user_id: 'demo-user',
      name: 'Main Conversion Path',
      description: 'Homepage to signup flow',
      is_active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      steps: [
        { id: 'step-1', name: 'Home Page', order: 1, type: 'page' as const, condition: { page: '/' } },
        { id: 'step-2', name: 'Feature Explore', order: 2, type: 'page' as const, condition: { page: '/features' } },
        { id: 'step-3', name: 'Pricing View', order: 3, type: 'page' as const, condition: { page: '/pricing' } },
        { id: 'step-4', name: 'Signup Start', order: 4, type: 'page' as const, condition: { page: '/signup' } },
        { id: 'step-5', name: 'Conversion', order: 5, type: 'event' as const, condition: { event: 'signup_complete' } },
      ],
    },
    {
      id: 'demo-funnel-2',
      website_id: 'demo',
      user_id: 'demo-user',
      name: 'Blog Reader Engagement',
      description: 'Blog to docs conversion',
      is_active: true,
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      steps: [
        { id: 'step-6', name: 'Blog Index', order: 1, type: 'page' as const, condition: { page: '/blog' } },
        { id: 'step-7', name: 'Article Read', order: 2, type: 'page' as const, condition: { page: '/blog/*' } },
        { id: 'step-8', name: 'Docs View', order: 3, type: 'page' as const, condition: { page: '/docs/*' } },
      ],
    },
  ],
  total: 2,
});

export const demoFunnelAnalytics = (funnelId: string) => {
  const data: Record<string, any> = {
    'demo-funnel-1': {
      analytics: [
        {
          funnel_id: 'demo-funnel-1',
          website_id: 'demo',
          date: new Date().toISOString(),
          total_starts: 85432,
          total_conversions: 4876,
          conversion_rate: 5.7,
          drop_off_rate: 94.3,
          avg_value: 0,
          total_value: 0,
          step_metrics: [
            { step: 1, name: 'Home Page', count: 85432, drop_off: 43245, drop_off_rate: 50.6 },
            { step: 2, name: 'Feature Explore', count: 42187, drop_off: 23755, drop_off_rate: 56.3 },
            { step: 3, name: 'Pricing View', count: 18432, drop_off: 8556, drop_off_rate: 46.4 },
            { step: 4, name: 'Signup Start', count: 9876, drop_off: 5000, drop_off_rate: 50.6 },
            { step: 5, name: 'Conversion', count: 4876, drop_off: 0, drop_off_rate: 0 },
          ],
        },
      ],
    },
    'demo-funnel-2': {
      analytics: [
        {
          funnel_id: 'demo-funnel-2',
          website_id: 'demo',
          date: new Date().toISOString(),
          total_starts: 34567,
          total_conversions: 4231,
          conversion_rate: 12.2,
          drop_off_rate: 87.8,
          avg_value: 0,
          total_value: 0,
          step_metrics: [
            { step: 1, name: 'Blog Index', count: 34567, drop_off: 19135, drop_off_rate: 55.3 },
            { step: 2, name: 'Article Read', count: 15432, drop_off: 11201, drop_off_rate: 72.5 },
            { step: 3, name: 'Docs View', count: 4231, drop_off: 0, drop_off_rate: 0 },
          ],
        },
      ],
    },
  };
  return data[funnelId] || { analytics: [] };
};

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
