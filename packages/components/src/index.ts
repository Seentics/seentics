// @seentics/components — embeddable React components for Seentics
//
// Usage:
//   import { SeenticsProvider, TrafficChart, ErrorList } from '@seentics/components'
//
//   <SeenticsProvider apiKey="sk_age_..." baseUrl="https://api.yourdomain.com">
//     <TrafficChart siteId="site_abc" metric="pageviews" groupBy="day" />
//     <ErrorList projectId="proj_xyz" service="checkout-api" />
//   </SeenticsProvider>

// Provider
export { SeenticsProvider } from './provider/SeenticsProvider'

// Analytics
export { AnalyticsSummary } from './analytics/AnalyticsSummary'
export { TrafficChart } from './analytics/TrafficChart'
export { TopPages } from './analytics/TopPages'
export { TopSources } from './analytics/TopSources'
export { GoalConversions } from './analytics/GoalConversions'
export { FunnelChart } from './analytics/FunnelChart'
export { RealtimeCounter } from './analytics/RealtimeCounter'

// Behavior
export { HeatmapViewer } from './behavior/HeatmapViewer'
export { SessionReplayPlayer } from './behavior/SessionReplayPlayer'

// Observability
export { LogExplorer } from './observability/LogExplorer'
export { ErrorList } from './observability/ErrorList'
export { TraceWaterfall } from './observability/TraceWaterfall'
export { MetricsChart } from './observability/MetricsChart'
