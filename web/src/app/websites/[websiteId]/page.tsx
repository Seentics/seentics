//@ts-ignore
'use client';

import { GeolocationOverview } from '@/components/analytics/GeolocationOverview';
import { TopCountriesChart } from '@/components/analytics/TopCountriesChart';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { UTMPerformanceChart } from '@/components/analytics/UTMPerformanceChart';
import { RecentActivityFeed } from '@/components/analytics/RecentActivityFeed';
import type { EventAnnotation } from '@/components/analytics/EventAnnotations';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useToast } from '@/hooks/use-toast';
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
  useGoalStats,
  usePreviousPeriodDailyStats,
  useRecentActivity,
} from '@/lib/analytics-api';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { format } from 'date-fns';
import { getDemoData, getDemoWebsite } from '@/lib/demo-data';
import Link from 'next/link';
import { CalendarIcon, Download, Globe, PlusCircle, Settings, Filter, ArrowUpRight, ArrowDownRight, Clock, Eye, Users, TrendingDown, ChevronRight, Target, X, Zap, Gauge } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DetailedDataModal } from '@/components/analytics/DetailedDataModal';
import { EventsDetails } from '@/components/analytics/EventsDetails';
import { GoalConversions } from '@/components/analytics/GoalConversions';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { PagePerformanceTable } from '@/components/analytics/PagePerformanceTable';

import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { AddGoalModal } from '@/components/websites/modals/AddGoalModal';
import { FilterModal } from '@/components/analytics/FilterModal';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { ThemeToggle } from '@/components/theme-toggle';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { LayoutDashboard } from 'lucide-react';

// Pure helper — defined outside component so it's never re-created on render
function categorizeReferrer(referrer: string): string {
  if (!referrer || referrer === 'Direct') return 'Direct';
  const r = referrer.toLowerCase();
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
  if (r.includes('localhost') || r.includes('127.0.0.1') || r.includes('internal')) return 'Internal Navigation';
  return referrer;
}

export default function WebsiteDashboardPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedModal, setSelectedModal] = useState<string | null>(null);
  const [modalType, setModalType] = useState<string>('');
  const [showAddWebsiteModal, setShowAddWebsiteModal] = useState(false);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);

  // Filter state
  const [dateRange, setDateRange] = useState<number>(7);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [utmTab, setUtmTab] = useState<'sources' | 'mediums' | 'campaigns' | 'terms' | 'content'>('sources');
  const [advancedFilters, setAdvancedFilters] = useState<any>({});

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

  // Click-to-filter handler
  const handleDashboardFilter = useCallback((filter: Record<string, string>) => {
    setAdvancedFilters((prev: any) => ({ ...prev, ...filter }));
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

    const filterKeys = ['country', 'device', 'browser', 'os', 'utm_source', 'utm_medium', 'utm_campaign', 'page_path'];
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

  // Sync filters to URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (dateRange !== 7) params.set('days', dateRange.toString());
    Object.entries(advancedFilters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
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
            setWebsites([getDemoWebsite(), ...data]);
          } else {
            setWebsites(data);
          }
        } catch (error) {
          console.error('Failed to load websites', error);
          // If in demo mode and API fails, still show demo website
          if (isDemoMode) {
            setWebsites([getDemoWebsite()]);
          }
        }
      } else if (isDemoMode) {
        // Allow demo mode even without authentication
        setWebsites([getDemoWebsite()]);
      }
    };
    loadWebsites();
  }, [user, isDemoMode]);

  const currentWebsite = websites.find(w => w.id === websiteId);

  // ── PRIORITY: above-the-fold data (SummaryCards + TrafficOverview) ──
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData(websiteId, dateRange, advancedFilters);
  const { data: dailyStats, isLoading: dailyLoading } = useDailyStats(websiteId, dateRange, advancedFilters);
  const { data: hourlyStats, isLoading: hourlyLoading } = useHourlyStats(websiteId, dateRange, advancedFilters);
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
  const { data: goalStats, isLoading: goalStatsLoading } = useGoalStats(deferredId, dateRange);
  const { data: recentActivity, isLoading: recentActivityLoading } = useRecentActivity(deferredId);

  // Previous period data for comparison overlay
  const { data: previousDailyStats } = usePreviousPeriodDailyStats(deferredId, dateRange, showComparison);

  // Memoize demo data so getDemoData() is not called on every render
  const demoData = useMemo(() => (isDemoMode ? getDemoData() : null), [isDemoMode]);

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
    return {
      top_referrers: src?.top_referrers?.map((ref: any) => ({
        referrer: categorizeReferrer(ref.referrer || 'Direct'),
        visitors: ref.unique || 0,
        page_views: ref.views || 0,
        avg_session_duration: 0,
      })) ?? [],
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
    const emptyUtm = { sources: {}, mediums: {}, campaigns: {}, terms: {}, content: {}, avg_ctr: 0, total_campaigns: 0, total_sources: 0, total_mediums: 0 };

    const filteredEvents = (src?.top_events ?? []).filter(
      (event: any) => event.event_type !== 'pageview' && event.event_type !== 'page_view'
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

  // Only show user-defined goals, no fallback to auto-tracked events
  const finalGoalStats = useMemo(() => goalStats?.goals ?? [], [goalStats]);


  const handleExportCSV = useCallback(() => {
    const rows: string[][] = [
      ['Metric', 'Value'],
      ['Total Visitors', String(finalDashboardData?.total_visitors ?? 0)],
      ['Unique Visitors', String(finalDashboardData?.unique_visitors ?? 0)],
      ['Page Views', String(finalDashboardData?.page_views ?? 0)],
      ['Bounce Rate', `${(finalDashboardData?.bounce_rate ?? 0).toFixed(1)}%`],
      ['Session Duration (s)', String(finalDashboardData?.session_duration ?? 0)],
      [],
      ['Date', 'Visitors', 'Page Views'],
      ...(finalDailyStats?.daily_stats ?? []).map((d: any) => [d.date, String(d.unique ?? 0), String(d.views ?? 0)]),
      [],
      ['Page', 'Views', 'Unique Visitors'],
      ...(finalTopPages?.top_pages ?? []).map((p: any) => [p.page, String(p.views ?? 0), String(p.unique_visitors ?? 0)]),
      [],
      ['Country', 'Visitors'],
      ...(finalTopCountries?.top_countries ?? []).map((c: any) => [c.country, String(c.visitors ?? 0)]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${currentWebsite?.name ?? websiteId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [finalDashboardData, finalDailyStats, finalTopPages, finalTopCountries, currentWebsite, websiteId]);

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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <DashboardPageHeader
          title="Overview"
          description="Track your website visitor behavior in real-time."
        >
          <div className="flex items-center gap-3">
            {/* Demo Mode Badge */}
            {/* {isDemoMode && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20 shadow-sm shadow-blue-500/5">
                  DEMO MODE
                </div>
              )} */}
          </div>

          <div className="h-10 w-10 flex items-center justify-center bg-card/50 backdrop-blur-md hover:bg-card transition-colors rounded shadow-sm border border-border/40">
            <ThemeToggle />
          </div>
          {/* Website Switcher */}
          <Select value={websiteId} onValueChange={handleWebsiteChange}>
            <SelectTrigger className="w-full sm:w-[220px] h-10 bg-card/50 backdrop-blur-md  hover:bg-card transition-colors rounded shadow-sm border border-border/40">
              <div className="flex items-center truncate">
                <Globe className="mr-2 h-4 w-4 text-primary shrink-0" />
                <span className="truncate font-bold text-sm tracking-tight text-foreground">{currentWebsite?.name || 'Select website'}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded shadow-2xl bg-card">
              {websites.map((site) => (
                <SelectItem key={site.id} value={site.id} className="rounded py-2">
                  <span className="font-medium text-foreground">{site.name}</span>
                </SelectItem>
              ))}
              {websites.length > 0 && (
                <>
                  <div className="h-px bg-border my-1 mx-2" />
                  <SelectItem value="add-new" className="text-primary rounded py-2">
                    <div className="flex items-center font-bold">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Website
                    </div>
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 flex-wrap">
            <FilterModal
              dateRange={dateRange}
              isCustomRange={isCustomRange}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onDateRangeChange={handleDateRangeChange}
              onCustomDateChange={handleCustomDateChange}
              onFiltersChange={setAdvancedFilters}
              activeFiltersCount={Object.keys(advancedFilters).length}
            />
            <button
              onClick={handleExportCSV}
              className="h-10 px-3 flex items-center gap-2 bg-card/50 backdrop-blur-md hover:bg-card transition-colors rounded shadow-sm border border-border/40 text-xs font-bold text-foreground"
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              Export
            </button>
          </div>
        </DashboardPageHeader>

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
          <div className="flex items-center gap-2 px-1">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Audience Intelligence</h2>
            <div className="h-px bg-border flex-1 ml-4" />
          </div>

          {/* Pages & Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-8">
                <ChartErrorBoundary label="Top Pages">
                  <TopPagesChart
                    data={transformedTopPages}
                    entryPages={finalVisitorInsights?.visitor_insights?.top_entry_pages}
                    exitPages={finalVisitorInsights?.visitor_insights?.top_exit_pages}
                    isLoading={pagesLoading || visitorInsightsLoading}
                    onFilter={handleDashboardFilter}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-8">
                <ChartErrorBoundary label="Top Sources">
                  <TopSourcesChart data={transformedTopReferrers} isLoading={referrersLoading} onFilter={handleDashboardFilter} />
                </ChartErrorBoundary>
              </CardContent>
            </Card>
          </div>

          {/* Geolocation Map — full width */}
          <ChartErrorBoundary label="Geographic Intelligence">
            <GeolocationOverview
              data={finalGeolocationData}
              isLoading={!isDemoMode && geolocationLoading}
              onFilter={handleDashboardFilter}
            />
          </ChartErrorBoundary>

          {/* Devices + Live Activity — 2-col grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-8">
                <ChartErrorBoundary label="Top Devices">
                  <TopDevicesChart
                    data={transformedTopDevices}
                    osData={transformedTopOS}
                    screenData={transformedTopResolutions}
                    browserData={transformedTopBrowsers}
                    isLoading={devicesLoading || osLoading || resolutionsLoading || browsersLoading}
                    onFilter={handleDashboardFilter}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-8">
                <ChartErrorBoundary label="Live Activity">
                  <RecentActivityFeed
                    data={recentActivity}
                    isLoading={!isDemoMode && recentActivityLoading}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* PAGE PERFORMANCE */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Gauge className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Page Performance</h2>
            <div className="h-px bg-border flex-1 ml-4" />
          </div>

          <Card className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-8">
              <ChartErrorBoundary label="Page Performance">
                <PagePerformanceTable
                  data={(isDemoMode ? demoData?.topPages : topPages) || { top_pages: [] }}
                  isLoading={!isDemoMode && pagesLoading}
                />
              </ChartErrorBoundary>
            </CardContent>
          </Card>
        </div>

        {/* CONVERSION & MARKETING INTELLIGENCE */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Conversion & Marketing</h2>
            <div className="h-px bg-border flex-1 ml-4" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Goal Conversions */}
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardHeader className="p-8 pb-4 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">Goal Conversions</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Behavioral targets</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/websites/${websiteId}/settings?tab=goals`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs font-medium rounded text-muted-foreground hover:text-foreground gap-1.5">
                        <Settings className="h-3 w-3" />
                        Manage
                      </Button>
                    </Link>
                    <Button
                      onClick={() => setShowAddGoalModal(true)}
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium rounded gap-1.5 shadow-sm transition-transform active:scale-95"
                    >
                      <PlusCircle className="h-3 w-3" />
                      Add Goal
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                <ChartErrorBoundary label="Goal Conversions">
                  <GoalConversions
                    items={finalGoalStats}
                    totalVisitors={finalDashboardData?.unique_visitors || 0}
                    isLoading={!isDemoMode && goalStatsLoading}
                  />
                </ChartErrorBoundary>
              </CardContent>
            </Card>

            {/* Campaign Intelligence */}
            <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-8 pb-4 border-b border-border/60">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="min-w-0 shrink-0">
                    <h3 className="text-base font-semibold tracking-tight whitespace-nowrap">Campaign Intelligence</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">UTM source & performance</p>
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
                <UTMPerformanceChart
                  data={transformedCustomEvents.utm_performance as any}
                  isLoading={customEventsLoading}
                  hideTabs={true}
                  controlledTab={utmTab}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CUSTOM EVENTS TRACKER */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Custom Events</h2>
            <div className="h-px bg-border flex-1 ml-4" />
          </div>

          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader className="p-8 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold tracking-tight">Event Tracker</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Clicks, form submissions, downloads & custom interactions</p>
                </div>
                {transformedCustomEvents.top_events.length > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-bold">{transformedCustomEvents.top_events.length}</p>
                    <p className="text-[10px] text-muted-foreground">event types</p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <ChartErrorBoundary label="Custom Events">
                <EventsDetails
                  items={transformedCustomEvents.top_events}
                  isLoading={!isDemoMode && customEventsLoading}
                />
              </ChartErrorBoundary>
            </CardContent>
          </Card>
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
    <div className="min-h-screen bg-background">
      <main className="p-6 md:p-8 lg:p-10 w-full max-w-[1400px] mx-auto">
        {dashboardContent}
      </main>

      {/* Add Website Modal */}
      <AddWebsiteModal
        open={showAddWebsiteModal}
        onOpenChange={setShowAddWebsiteModal}
        onSuccess={handleWebsiteAdded}
      />

      <AddGoalModal
        open={showAddGoalModal}
        onOpenChange={setShowAddGoalModal}
        websiteId={websiteId}
      />
    </div>
  );
}
