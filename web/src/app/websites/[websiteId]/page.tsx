'use client';

import { GeolocationOverview } from '@/components/analytics/GeolocationOverview';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { UTMPerformanceChart } from '@/components/analytics/UTMPerformanceChart';
import type { EventAnnotation } from '@/components/analytics/EventAnnotations';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  useCustomEvents,
  useDailyStats,
  useDashboardData,
  useGeolocationBreakdown,
  useHourlyStats,
  useTopBrowsers,
  useTopCountries,
  useTopDevices,
  useTopOS,
  useTopResolutions,
  useTopPages,
  useTopReferrers,
  useVisitorInsights,
  usePreviousPeriodDailyStats,
} from '@/lib/analytics-api';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { demoAnalyticsData, demoWebsite } from '@/lib/demo';
import { Globe, PlusCircle, Sparkles, Users, X } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetailedDataModal } from '@/components/analytics/DetailedDataModal';
import { SummaryCards } from '@/components/analytics/SummaryCards';

import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { FilterModal } from '@/components/analytics/FilterModal';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { ThemeToggle } from '@/components/theme-toggle';
import { WebsiteGoalsSection } from '@/components/analytics/WebsiteGoalsSection';
import { AICommandModal } from '@/components/ai/AICommandModal';
import { useSubscription } from '@/hooks/useSubscription';

// Pure helper — defined outside component so it's never re-created on render
function categorizeReferrer(referrer: string): string {
  const raw = (referrer ?? '').trim();
  if (!raw || raw === 'Direct') return 'Direct';
  const r = raw.toLowerCase();
  if (r.includes('accounts.google.com')) return 'Google OAuth';
  if (r.includes('google')) return 'Google';
  if (r.includes('bing')) return 'Bing';
  if (r.includes('yahoo')) return 'Yahoo';
  if (r.includes('duckduckgo')) return 'DuckDuckGo';
  if (r.includes('facebook')) return 'Facebook';
  if (r.includes('twitter')) return 'Twitter';
  if (r.includes('linkedin')) return 'LinkedIn';
  if (r.includes('github')) return 'GitHub';
  if (r.includes('youtube')) return 'YouTube';
  if (r.includes('instagram')) return 'Instagram';
  if (r.includes('reddit')) return 'Reddit';
  if (r.includes('medium')) return 'Medium';
  if (r.includes('stackoverflow')) return 'Stack Overflow';
  if (r.includes('dev.to')) return 'Dev.to';
  if (r.includes('hashnode')) return 'Hashnode';
  if (r.includes('producthunt')) return 'Product Hunt';
  if (r.includes('hackernews')) return 'Hacker News';
  // Same-origin / dev: self-referrals, not acquisition
  if (
    r.includes('localhost') ||
    r.includes('127.0.0.1') ||
    r.includes('::1') ||
    r.startsWith('http://0.0.0.0') ||
    r.includes('192.168.') ||
    r.includes('10.0.') ||
    /\.local(\/|:|$)/.test(r)
  ) {
    return 'Internal Navigation';
  }
  // Extract domain for unknown referrers instead of showing full URL
  const domain = r.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  return domain || raw;
}

export default function WebsiteDashboardPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [aiOpen, setAiOpen] = useState(false);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedModal, setSelectedModal] = useState<string | null>(null);
  const [modalType, setModalType] = useState<string>('');
  const [showAddWebsiteModal, setShowAddWebsiteModal] = useState(false);

  // Filter state
  const [dateRange, setDateRange] = useState<number>(7);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [utmTab, setUtmTab] = useState<'sources' | 'mediums' | 'campaigns' | 'terms' | 'content'>('sources');
  const [advancedFilters, setAdvancedFilters] = useState<any>({});
  /** UTM params removed from URL only after they were set via dashboard filters (not raw marketing links). */
  const utmKeysAppliedFromFiltersRef = useRef<Set<string>>(new Set());

  // Comparison & Annotations state
  const [showComparison, setShowComparison] = useState(false);
  // Initialize with empty array; load from localStorage once websiteId is known
  const [annotations, setAnnotations] = useState<EventAnnotation[]>([]);

  // Load annotations from localStorage when websiteId becomes available
  useEffect(() => {
    if (!websiteId) return;
    try {
      const stored = localStorage.getItem(`annotations-${websiteId}`);
      if (stored) {
        setAnnotations(JSON.parse(stored, (key, value) => key === 'date' ? new Date(value) : value));
      }
    } catch { /* ignore corrupt data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId]);

  // Persist annotations to localStorage whenever they change
  useEffect(() => {
    if (!websiteId) return;
    localStorage.setItem(`annotations-${websiteId}`, JSON.stringify(annotations));
  }, [annotations, websiteId]);

  const handleAddAnnotation = useCallback((annotation: Omit<EventAnnotation, 'id'>) => {
    setAnnotations(prev => [...prev, { ...annotation, id: crypto.randomUUID() }]);
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  const removeFilter = useCallback((key: string) => {
    setAdvancedFilters((prev: any) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // URL-based filter state
  const searchParams = useSearchParams();

  // Initialize filters from URL on mount
  useEffect(() => {
    const urlDays = searchParams.get('days');
    if (urlDays) setDateRange(parseInt(urlDays));

    // Omit utm_* — same query params are used on this URL for self-tracking / attribution tests;
    // treating them as dashboard filters shows a bogus "Active filters" row and narrows charts.
    const filterKeys = ['country', 'device', 'browser', 'os', 'page_path'];
    const urlFilters: Record<string, string> = {};
    filterKeys.forEach(key => {
      const val = searchParams.get(key);
      if (val) urlFilters[key] = val;
    });
    if (Object.keys(urlFilters).length > 0) {
      setAdvancedFilters((prev: any) => ({ ...prev, ...urlFilters }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL — merge into existing query so marketing params (utm_*, gclid, …) survive.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (dateRange === 7) params.delete('days');
    else params.set('days', String(dateRange));

    const standardFilterKeys = ['country', 'device', 'browser', 'os', 'page_path'] as const;
    for (const key of standardFilterKeys) {
      const v = advancedFilters[key];
      if (v != null && String(v).length > 0) params.set(key, String(v));
      else params.delete(key);
    }

    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign'] as const;
    for (const key of utmKeys) {
      const v = advancedFilters[key];
      if (v != null && String(v).length > 0) {
        params.set(key, String(v));
        utmKeysAppliedFromFiltersRef.current.add(key);
      } else if (utmKeysAppliedFromFiltersRef.current.has(key)) {
        params.delete(key);
        utmKeysAppliedFromFiltersRef.current.delete(key);
      }
    }

    const qs = params.toString();
    const path = window.location.pathname;
    const newUrl = qs ? `${path}?${qs}` : path;
    if (newUrl !== `${path}${window.location.search}`) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [dateRange, advancedFilters]);

  // Check if we're in demo mode
  const isDemoMode = websiteId === 'demo';

  // Fetch websites for switcher
  useEffect(() => {
    const loadWebsites = async () => {
      if (user) {
        try {
          const data = await getWebsites();
          // Add demo website to the list if in demo mode
          if (isDemoMode) {
            setWebsites([demoWebsite(), ...data]);
          } else {
            setWebsites(data);
          }
        } catch (error) {
          console.error('Failed to load websites', error);
          // If in demo mode and API fails, still show demo website
          if (isDemoMode) {
            setWebsites([demoWebsite()]);
          }
        }
      } else if (isDemoMode) {
        // Allow demo mode even without authentication
        setWebsites([demoWebsite()]);
      }
    };
    loadWebsites();
  }, [user, isDemoMode]);

  const currentWebsite = websites.find(w => w.id === websiteId);

  // ── PRIORITY: above-the-fold data (SummaryCards + TrafficOverview) ──
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData(websiteId, dateRange, advancedFilters);
  const { data: dailyStats, isLoading: dailyLoading } = useDailyStats(websiteId, dateRange, advancedFilters);
  const { data: hourlyStats } = useHourlyStats(websiteId, dateRange, advancedFilters);
  const { data: visitorInsights, isLoading: visitorInsightsLoading } = useVisitorInsights(websiteId, dateRange);

  // ── DEFERRED: below-the-fold data (loads after primary data arrives) ──
  // Pass empty websiteId to disable hooks until dashboard data is ready
  const deferredId = (isDemoMode || !!dashboardData) ? websiteId : '';

  const { data: topPages, isLoading: pagesLoading, error: pagesError } = useTopPages(deferredId, dateRange, advancedFilters);
  const { data: topReferrers, isLoading: referrersLoading, error: referrersError } = useTopReferrers(deferredId, dateRange, advancedFilters);
  const { data: topCountries, isLoading: countriesLoading, error: countriesError } = useTopCountries(deferredId, dateRange, advancedFilters);
  const { data: topBrowsers, isLoading: browsersLoading, error: browsersError } = useTopBrowsers(deferredId, dateRange, advancedFilters);
  const { data: topDevices, isLoading: devicesLoading, error: devicesError } = useTopDevices(deferredId, dateRange, advancedFilters);
  const { data: topOS, isLoading: osLoading, error: osError } = useTopOS(deferredId, dateRange, advancedFilters);
  const { data: topResolutions, isLoading: resolutionsLoading } = useTopResolutions(deferredId, dateRange);
  const { data: geolocationData, isLoading: geolocationLoading, error: geolocationError } = useGeolocationBreakdown(deferredId, dateRange);
  const { data: customEvents, isLoading: customEventsLoading } = useCustomEvents(deferredId, dateRange);

  // Previous period data for comparison overlay
  const { data: previousDailyStats } = usePreviousPeriodDailyStats(deferredId, dateRange, showComparison);

  // Memoize demo data so demoAnalyticsData() is not called on every render
  const demoData = useMemo(() => (isDemoMode ? demoAnalyticsData() : null), [isDemoMode]);

  // Use demo data when in demo mode, otherwise use API data
  const finalDashboardData = isDemoMode ? demoData?.dashboardData : dashboardData;
  const finalTopPages = isDemoMode ? demoData?.topPages : topPages;
  const finalTopReferrers = isDemoMode ? demoData?.topReferrers : topReferrers;
  const finalTopCountries = isDemoMode ? demoData?.topCountries : topCountries;
  const finalTopBrowsers = isDemoMode ? demoData?.topBrowsers : topBrowsers;
  const finalTopDevices = isDemoMode ? demoData?.topDevices : topDevices;
  const finalDailyStats = isDemoMode ? demoData?.dailyStats : dailyStats;
  const finalHourlyStats = isDemoMode ? demoData?.hourlyStats : hourlyStats;
  const finalGeolocationData = isDemoMode ? demoData?.geolocationData : geolocationData;
  const finalVisitorInsights = isDemoMode ? demoData?.visitorInsights : visitorInsights;
  const finalPreviousDailyStats = isDemoMode ? demoData?.dailyStats : previousDailyStats;

  const transformedTopPages = useMemo(() => {
    const src = isDemoMode ? demoData?.topPages : topPages;
    return {
      top_pages: src?.top_pages?.map((page: any) => ({
        page: page.page || '/',
        views: page.views || 0,
        unique_visitors: page.unique || 0,
        avg_time_on_page: page.avg_time || 0,
        bounce_rate: page.bounce_rate || 0,
      })) ?? [],
    };
  }, [isDemoMode, demoData, topPages]);

  const transformedTopReferrers = useMemo(() => {
    const src = isDemoMode ? demoData?.topReferrers : topReferrers;
    const merged = new Map<string, { visitors: number; page_views: number }>();
    for (const ref of src?.top_referrers ?? []) {
      const label = categorizeReferrer(ref.referrer ?? 'Direct');
      const cur = merged.get(label) ?? { visitors: 0, page_views: 0 };
      cur.visitors += ref.unique ?? 0;
      cur.page_views += ref.views ?? 0;
      merged.set(label, cur);
    }
    return {
      top_referrers: [...merged.entries()]
        .map(([referrer, v]) => ({
          referrer,
          visitors: v.visitors,
          page_views: v.page_views,
          avg_session_duration: 0,
        }))
        .sort((a, b) => b.visitors - a.visitors),
    };
  }, [isDemoMode, demoData, topReferrers]);

  const transformedTopCountries = useMemo(() => {
    const src = isDemoMode ? demoData?.topCountries : topCountries;
    return {
      top_countries: src?.top_countries?.map((country: any) => ({
        country: country.country || 'Unknown',
        visitors: country.unique || 0,
        page_views: country.views || 0,
        avg_session_duration: 0,
      })) ?? [],
    };
  }, [isDemoMode, demoData, topCountries]);

  const transformedTopBrowsers = useMemo(() => {
    const src = isDemoMode ? demoData?.topBrowsers : topBrowsers;
    return {
      top_browsers: src?.top_browsers?.map((browser: any) => ({
        browser: browser.browser || 'Unknown',
        visitors: browser.unique || 0,
        views: browser.views || 0,
        market_share: 0,
        version: 'Unknown',
      })) ?? [],
    };
  }, [isDemoMode, demoData, topBrowsers]);

  const transformedTopDevices = useMemo(() => {
    const src = isDemoMode ? demoData?.topDevices : topDevices;
    return {
      top_devices: src?.top_devices?.map((device: any) => ({
        device: device.device || 'Unknown',
        visitors: device.unique || 0,
        page_views: device.views || 0,
        avg_session_duration: 0,
      })) ?? [],
    };
  }, [isDemoMode, demoData, topDevices]);

  const transformedTopOS = useMemo(() => {
    const src = isDemoMode ? demoData?.topOS : topOS;
    return {
      top_os: src?.top_os?.map((os: any) => ({
        os: os.os || 'Unknown',
        visitors: os.unique || 0,
        page_views: os.views || 0,
        avg_session_duration: 0,
      })) ?? [],
    };
  }, [isDemoMode, demoData, topOS]);

  const transformedTopResolutions = useMemo(() => {
    const src = isDemoMode
      ? {
          top_resolutions: [
            { name: '1920x1080', count: 450, percentage: 45.0 },
            { name: '1366x768', count: 320, percentage: 32.0 },
            { name: '375x812', count: 280, percentage: 28.0 },
            { name: '1440x900', count: 210, percentage: 21.0 },
            { name: '414x896', count: 150, percentage: 15.0 },
          ],
        }
      : topResolutions;
    return {
      top_resolutions: src?.top_resolutions?.map((res: any) => ({
        name: res.name || 'Unknown',
        count: res.count || 0,
        percentage: res.percentage || 0,
      })) ?? [],
    };
  }, [isDemoMode, topResolutions]);

  // Transform custom events — filter pageview events and compute totals in one pass
  const transformedCustomEvents = useMemo(() => {
    const src = isDemoMode ? demoData?.customEvents : customEvents;
    const emptyUtm = {
      sources: [] as { source: string; unique_visitors: number; visits: number }[],
      mediums: [] as { medium: string; unique_visitors: number; visits: number }[],
      campaigns: [] as { campaign: string; unique_visitors: number; visits: number }[],
      terms: [] as { term: string; unique_visitors: number; visits: number }[],
      content: [] as { content: string; unique_visitors: number; visits: number }[],
      avg_ctr: 0,
      total_campaigns: 0,
      total_sources: 0,
      total_mediums: 0,
    };

    // Filter out internal tracker events — these are already reflected in other dashboard sections
    const internalEvents = new Set(['pageview', 'page_view', 'page_exit', 'scroll_depth', 'click']);
    const filteredEvents = (src?.top_events ?? []).filter(
      (event: any) => !internalEvents.has(event.event_type)
    );

    return {
      timeseries: src?.timeseries ?? [],
      top_events: filteredEvents,
      // Include page_views in total so summary cards reflect full traffic
      total_events: filteredEvents.reduce((sum: number, e: any) => sum + e.count, 0) + (finalDashboardData?.page_views ?? 0),
      unique_events: filteredEvents.length,
      utm_performance: src?.utm_performance ?? emptyUtm,
    };
  }, [isDemoMode, demoData, customEvents, finalDashboardData?.page_views]);

  const handleModalClose = () => {
    setSelectedModal(null);
    setModalType('');
  };

  const handleDateRangeChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomRange(true);
    } else {
      setIsCustomRange(false);
      setDateRange(parseInt(value));
    }
  };

  const handleCustomDateChange = (start: Date | undefined, end: Date | undefined) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    if (start && end) {
      // Calculate days between dates for the API
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDateRange(diffDays);
    }
  };

  const handleWebsiteChange = (siteId: string) => {
    if (siteId === 'add-new') {
      setShowAddWebsiteModal(true);
    } else {
      router.push(`/websites/${siteId}`);
    }
  };

  const handleWebsiteAdded = (websiteId: string) => {
    // Redirect to the newly added website
    router.push(`/websites/${websiteId}`);
  };


  const dashboardContent = !isDemoMode && dashboardError ? (
    <div className="p-8 text-center bg-red-50 text-red-800 rounded">
      Failed to load analytics data.
    </div>
  ) : (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* ── Header — single compact row ── */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">

          {/* Website Switcher */}
          <Select value={websiteId} onValueChange={handleWebsiteChange}>
            <SelectTrigger className="w-[180px] h-8 bg-card/50 hover:bg-card transition-colors rounded-md border border-border/40 text-xs">
              <div className="flex items-center truncate">
                <Globe className="mr-1.5 h-3 w-3 text-primary shrink-0" />
                <span className="truncate font-medium text-foreground">{currentWebsite?.name || 'Select website'}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-md bg-card">
              {websites.map((site) => (
                <SelectItem key={site.id} value={site.id} className="rounded text-xs py-1.5">
                  <span className="font-medium text-foreground">{site.name}</span>
                </SelectItem>
              ))}
              {websites.length > 0 && (
                <>
                  <div className="h-px bg-border my-1 mx-2" />
                  <SelectItem value="add-new" className="text-primary rounded text-xs py-1.5">
                    <div className="flex items-center font-medium">
                      <PlusCircle className="mr-1.5 h-3 w-3" />
                      Add Website
                    </div>
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          {/* Spacer pushes controls to the right */}
          <div className="flex-1" />

          {/* AI button */}
          <button
            onClick={() => setAiOpen(true)}
            title="Seentics AI (⌘K)"
            className="group flex items-center gap-2.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-400 transition-all hover:border-indigo-500/60 hover:bg-indigo-500/15 hover:text-indigo-300"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Ask Seentics AI</span>
            <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400/80 tracking-wide">BETA</span>
            <kbd className="hidden rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">⌘K</kbd>
          </button>

          {/* Filters */}
          <FilterModal
            dateRange={dateRange}
            isCustomRange={isCustomRange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onDateRangeChange={handleDateRangeChange}
            onCustomDateChange={handleCustomDateChange}
            onFiltersChange={setAdvancedFilters}
            activeFiltersCount={Object.keys(advancedFilters).length}
            currentFilters={advancedFilters}
          />

{/* Theme — same box as row controls; compact icon matches Filter button height */}
          <div className="flex h-8 shrink-0 items-center justify-center rounded-md border border-border/40 bg-card/50 transition-colors hover:bg-card">
            <ThemeToggle />
          </div>
        </div>

        {/* Stats Grid */}
        {/* Summary Cards */}
        <div className="">
          {/* SummaryCards already inside dashboard. Transforming to use better container if needed. */}
          <SummaryCards
            websiteId={websiteId}
            isDemo={isDemoMode}
            isLoading={!isDemoMode && dashboardLoading}
            data={finalDashboardData || {
              total_visitors: 0,
              unique_visitors: 0,
              live_visitors: 0,
              page_views: 0,
              session_duration: 0,
              bounce_rate: 0,
              comparison: {}
            }}
            dailyStats={finalDailyStats}
            visitorInsights={finalVisitorInsights}
          />
        </div>

        {/* Active Filter Pills */}
        {Object.keys(advancedFilters).length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Active filters:</span>
            {Object.entries(advancedFilters).map(([key, value]) => (
              <button
                key={key}
                onClick={() => removeFilter(key)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <span className="text-muted-foreground">{key}:</span>
                <span>{String(value)}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              onClick={() => setAdvancedFilters({})}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Traffic Overview */}
        <section className="">
          <ChartErrorBoundary label="Traffic Overview">
            <TrafficOverview
              dailyStats={finalDailyStats}
              hourlyStats={finalHourlyStats}
              previousDailyStats={finalPreviousDailyStats}
              isLoading={!isDemoMode && (dashboardLoading || dailyLoading)}
              showComparison={showComparison}
              onComparisonToggle={setShowComparison}
              annotations={annotations}
              onAddAnnotation={handleAddAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
            />
          </ChartErrorBoundary>
        </section>



        {/* AUDIENCE INTELLIGENCE */}
        <div className="space-y-4">
 

          {/* Pages & Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-5">
                <ChartErrorBoundary label="Top Pages">
                  <TopPagesChart
                    data={transformedTopPages}
                    entryPages={finalVisitorInsights?.visitor_insights?.top_entry_pages}
                    exitPages={finalVisitorInsights?.visitor_insights?.top_exit_pages}
                    isLoading={pagesLoading || visitorInsightsLoading}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-5">
                <ChartErrorBoundary label="Top Sources">
                  <TopSourcesChart data={transformedTopReferrers} isLoading={referrersLoading} />
                </ChartErrorBoundary>
              </CardContent>
            </Card>
          </div>

          {/* Geolocation Map — full width */}
          <ChartErrorBoundary label="Geographic Intelligence">
            <GeolocationOverview
              data={finalGeolocationData}
              isLoading={!isDemoMode && geolocationLoading}
            />
          </ChartErrorBoundary>

          {/* Devices + UTM — 2-col grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-5">
                <ChartErrorBoundary label="Top Devices">
                  <TopDevicesChart
                    data={transformedTopDevices}
                    osData={transformedTopOS}
                    screenData={transformedTopResolutions}
                    browserData={transformedTopBrowsers}
                    isLoading={devicesLoading || osLoading || resolutionsLoading || browsersLoading}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-border/60">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="min-w-0 shrink-0">
                    <h3 className="text-base font-semibold tracking-tight whitespace-nowrap">UTM breakdown</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">Sources, mediums & campaigns</p>
                  </div>
                  <Tabs value={utmTab} onValueChange={(v) => setUtmTab(v as any)} className="w-full md:w-auto shrink-0">
                    <TabsList className="grid w-full grid-cols-3 h-8 bg-muted/50 p-0.5 rounded">
                      <TabsTrigger value="sources" className="h-7 text-xs font-medium rounded data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Sources</TabsTrigger>
                      <TabsTrigger value="mediums" className="h-7 text-xs font-medium rounded data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Mediums</TabsTrigger>
                      <TabsTrigger value="campaigns" className="h-7 text-xs font-medium rounded data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Campaigns</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartErrorBoundary label="UTM breakdown">
                  <UTMPerformanceChart
                    data={transformedCustomEvents.utm_performance as any}
                    isLoading={customEventsLoading}
                    hideTabs={true}
                    controlledTab={utmTab}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>
          </div>

          <ChartErrorBoundary label="Goals">
            <WebsiteGoalsSection websiteId={deferredId} days={dateRange} />
          </ChartErrorBoundary>

        </div>

        {/* Detailed Data Modal */}
        {selectedModal && (
          <DetailedDataModal
            isOpen={!!selectedModal}
            onClose={handleModalClose}
            modalType={modalType}
            data={{
              topPages: finalTopPages,
              topReferrers: finalTopReferrers,
              topCountries: finalTopCountries,
              topBrowsers: finalTopBrowsers,
              topDevices: finalTopDevices,
              dashboard: finalDashboardData,

            }}
            isLoading={{
              topPages: pagesLoading,
              topReferrers: referrersLoading,
              topCountries: countriesLoading,
              topBrowsers: browsersLoading,
              topDevices: devicesLoading,
              dashboard: dashboardLoading,

            }}
          />
        )}
      </div>
  );

  return (
    <div className="min-h-0 w-full bg-background">
      <div className="mx-auto w-full max-w-[1200px] p-4 md:p-6 lg:p-8">
        {dashboardContent}
      </div>

      {/* Add Website Modal */}
      <AddWebsiteModal
        open={showAddWebsiteModal}
        onOpenChange={setShowAddWebsiteModal}
        onSuccess={handleWebsiteAdded}
      />

      {/* AI Command Modal */}
      <AICommandModal
        websiteId={websiteId}
        open={aiOpen}
        onOpenChange={setAiOpen}
        aiUsage={isDemoMode ? undefined : subscription?.usage?.aiAnalyses}
      />
    </div>
  );
}
