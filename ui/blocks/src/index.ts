// @seentics/ui-blocks — reusable UI blocks for Seentics analytics
//
// Usage:
//   import { SeenticsProvider, TrafficChart, AnalyticsSummary } from '@seentics/ui-blocks'
//
//   <SeenticsProvider apiKey="sk_age_..." baseUrl="https://api.yourdomain.com">
//     <AnalyticsSummary siteId="site_abc" days={30} />
//     <TrafficChart     siteId="site_abc" days={30} />
//   </SeenticsProvider>

// Provider
export { SeenticsProvider }       from './provider/SeenticsProvider';
export type { SeenticsProviderProps } from './provider/SeenticsProvider';

// Analytics
export { AnalyticsSummary }       from './analytics/AnalyticsSummary';
export { TrafficChart }           from './analytics/TrafficChart';
export { TopPages }               from './analytics/TopPages';
export { TopSources }             from './analytics/TopSources';
export { GoalConversions }        from './analytics/GoalConversions';
export { FunnelChart }            from './analytics/FunnelChart';
export { RealtimeCounter }        from './analytics/RealtimeCounter';

// Behavior
export { HeatmapViewer }          from './behavior/HeatmapViewer';
export { SessionReplayPlayer }    from './behavior/SessionReplayPlayer';

// Types
export type {
  OverviewData, DailyStat, TimeseriesData,
  PageStat, TopPagesData, ReferrerStat, SourcesData,
  CustomEvent, EventsData, RealtimeData,
  Funnel, FunnelStep, FunnelStats, FunnelStepStat,
  HeatmapPageSummary, HeatmapPoint, HeatmapData,
  ReplaySession, RRWebEvent,
} from './lib/types';

// Hook for advanced usage
export { useSeentics }            from './context';
