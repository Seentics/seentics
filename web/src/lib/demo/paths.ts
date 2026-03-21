/**
 * Demo data for path analysis
 */

export const demoPathAnalysis = () => ({
  avg_path_length: 3.8,
  top_entry_pages: [
    { page: '/', count: 52187, percentage: 58.3 },
    { page: '/blog/why-real-time-matters', count: 12543, percentage: 14.0 },
    { page: '/features', count: 8765, percentage: 9.8 },
    { page: '/pricing', count: 6543, percentage: 7.3 },
    { page: '/docs/introduction', count: 4321, percentage: 4.8 },
  ],
  top_exit_pages: [
    { page: '/signup', count: 9876, percentage: 21.5 },
    { page: '/pricing', count: 6543, percentage: 14.2 },
    { page: '/', count: 5432, percentage: 11.8 },
    { page: '/contact', count: 2345, percentage: 5.1 },
    { page: '/docs/introduction', count: 1987, percentage: 4.3 },
  ],
  page_flows: [
    { from: '/', to: '/features', count: 28432, percentage: 33.2 },
    { from: '/', to: '/pricing', count: 18234, percentage: 21.3 },
    { from: '/', to: '/blog', count: 12543, percentage: 14.6 },
    { from: '/features', to: '/pricing', count: 15432, percentage: 36.5 },
    { from: '/pricing', to: '/signup', count: 9876, percentage: 23.4 },
    { from: '/blog', to: '/docs/introduction', count: 4231, percentage: 12.2 },
    { from: '/features', to: '/docs', count: 3456, percentage: 8.1 },
    { from: '/pricing', to: '/contact', count: 2345, percentage: 5.5 },
  ],
  total_paths_analyzed: 89432,
});
