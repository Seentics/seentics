//@ts-ignore
'use client';

import { GeolocationOverview } from '@/components/analytics/GeolocationOverview';
import { TopCountriesChart } from '@/components/analytics/TopCountriesChart';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { UTMPerformanceChart } from '@/components/analytics/UTMPerformanceChart';
import { RetentionCohortChart } from '@/components/analytics/RetentionCohortChart';
import { FrustrationSignals } from '@/components/analytics/FrustrationSignals';
import type { EventAnnotation } from '@/components/analytics/EventAnnotations';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useToast } from '@/hooks/use-toast';
import {
  useActivityTrends,
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
  useUserRetention,
  useVisitorInsights,
  useGoalStats,
  usePreviousPeriodDailyStats,
} from '@/lib/analytics-api';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { format } from 'date-fns';
import { getDemoData, getDemoWebsite } from '@/lib/demo-data';
import Link from 'next/link';
import { CalendarIcon, Download, Globe, PlusCircle, Settings, Filter, ArrowUpRight, ArrowDownRight, Clock, Eye, Users, TrendingDown, ChevronRight, Target, X } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { DetailedDataModal } from '@/components/analytics/DetailedDataModal';
import { EventsDetails } from '@/components/analytics/EventsDetails';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { AddGoalModal } from '@/components/websites/modals/AddGoalModal';
import { FilterModal } from '@/components/analytics/FilterModal';
import { ThemeToggle } from '@/components/theme-toggle';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { LayoutDashboard } from 'lucide-react';

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
  const [annotations, setAnnotations] = useState<EventAnnotation[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(`annotations-${websiteId}`);
      return stored ? JSON.parse(stored, (key, value) => key === 'date' ? new Date(value) : value) : [];
    } catch { return []; }
  });

  // Persist annotations to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && websiteId) {
      localStorage.setItem(`annotations-${websiteId}`, JSON.stringify(annotations));
    }
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

  // Helper function to categorize referrers for better display
  const categorizeReferrer = (referrer: string): string => {
    if (!referrer || referrer === 'Direct') return 'Direct';

    const lowerReferrer = referrer.toLowerCase();

    // Search engines
    if (lowerReferrer.includes('google')) return 'Google';
    if (lowerReferrer.includes('bing')) return 'Bing';
    if (lowerReferrer.includes('yahoo')) return 'Yahoo';
    if (lowerReferrer.includes('duckduckgo')) return 'DuckDuckGo';

    // Social media
    if (lowerReferrer.includes('facebook')) return 'Facebook';
    if (lowerReferrer.includes('twitter')) return 'Twitter';
    if (lowerReferrer.includes('linkedin')) return 'LinkedIn';
    if (lowerReferrer.includes('github')) return 'GitHub';
    if (lowerReferrer.includes('youtube')) return 'YouTube';
    if (lowerReferrer.includes('instagram')) return 'Instagram';
    if (lowerReferrer.includes('reddit')) return 'Reddit';

    // Tech platforms
    if (lowerReferrer.includes('medium')) return 'Medium';
    if (lowerReferrer.includes('stackoverflow')) return 'Stack Overflow';
    if (lowerReferrer.includes('dev.to')) return 'Dev.to';
    if (lowerReferrer.includes('hashnode')) return 'Hashnode';
    if (lowerReferrer.includes('producthunt')) return 'Product Hunt';
    if (lowerReferrer.includes('hackernews')) return 'Hacker News';

    // Internal navigation
    if (lowerReferrer.includes('localhost') || lowerReferrer.includes('127.0.0.1') || lowerReferrer.includes('internal')) {
      return 'Internal Navigation';
    }

    // For other domains, return the referrer as is (it should already be cleaned by backend)
    return referrer;
  };


  // Data hooks with dynamic date range - using real API data OR demo data
  // In demo mode, we skip API calls and use static demo data
  const demoData = isDemoMode ? getDemoData() : null;

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
  const { data: activityTrends, isLoading: trendsLoading, error: trendsError } = useActivityTrends(deferredId);
  const { data: retentionData, isLoading: retentionLoading } = useUserRetention(deferredId, dateRange);

  // Previous period data for comparison overlay
  const { data: previousDailyStats } = usePreviousPeriodDailyStats(deferredId, dateRange, showComparison);

  // Use demo data when in demo mode, otherwise use API data
  const finalDashboardData = isDemoMode ? demoData?.dashboardData : dashboardData;
  const finalTopPages = isDemoMode ? demoData?.topPages : topPages;
  const finalTopReferrers = isDemoMode ? demoData?.topReferrers : topReferrers;
  const finalTopCountries = isDemoMode ? demoData?.topCountries : topCountries;
  const finalTopBrowsers = isDemoMode ? demoData?.topBrowsers : topBrowsers;
  const finalTopDevices = isDemoMode ? demoData?.topDevices : topDevices;
  const finalTopOS = isDemoMode ? demoData?.topOS : topOS;
  const finalTopResolutions = isDemoMode ? { top_resolutions: [
    { name: '1920x1080', count: 450, percentage: 45.0 },
    { name: '1366x768', count: 320, percentage: 32.0 },
    { name: '375x812', count: 280, percentage: 28.0 },
    { name: '1440x900', count: 210, percentage: 21.0 },
    { name: '414x896', count: 150, percentage: 15.0 }
  ]} : topResolutions;
  const finalDailyStats = isDemoMode ? demoData?.dailyStats : dailyStats;
  const finalHourlyStats = isDemoMode ? demoData?.hourlyStats : hourlyStats;
  const finalGeolocationData = isDemoMode ? demoData?.geolocationData : geolocationData;
  const finalVisitorInsights = isDemoMode ? demoData?.visitorInsights : visitorInsights;
  const finalCustomEvents = isDemoMode ? demoData?.customEvents : customEvents;
  const finalActivityTrends = isDemoMode ? demoData?.activityTrends : activityTrends;
  const finalRetentionData = isDemoMode ? demoData?.retentionData : retentionData;
  const finalPreviousDailyStats = isDemoMode ? demoData?.dailyStats : previousDailyStats;

  // Transform API data to match demo component expectations
  const transformedTopPages = finalTopPages ? {
    top_pages: finalTopPages.top_pages?.map((page: any) => ({
      page: page.page || '/',
      views: page.views || 0,
      unique_visitors: page.unique || 0,
      avg_time_on_page: page.avg_time || 0,
      bounce_rate: page.bounce_rate || 0,
    })) || []
  } : {
    top_pages: []
  };

  const transformedTopReferrers = finalTopReferrers ? {
    top_referrers: finalTopReferrers.top_referrers?.map((ref: any) => {
      const referrer = ref.referrer || 'Direct';
      const categorizedReferrer = categorizeReferrer(referrer);
      return {
        referrer: categorizedReferrer,
        visitors: ref.unique || 0,
        page_views: ref.views || 0,
        avg_session_duration: 0,
      };
    }) || []
  } : {
    top_referrers: []
  };

  const transformedTopCountries = finalTopCountries ? {
    top_countries: finalTopCountries.top_countries?.map((country: any) => ({
      country: country.country || 'Unknown',
      visitors: country.unique || 0,
      page_views: country.views || 0,
      avg_session_duration: 0,
    })) || []
  } : {
    top_countries: []
  };

  const transformedTopBrowsers = finalTopBrowsers ? {
    top_browsers: finalTopBrowsers.top_browsers?.map((browser: any) => ({
      browser: browser.browser || 'Unknown',
      visitors: browser.unique || 0,
      views: browser.views || 0,
      market_share: 0,
      version: 'Unknown',
    })) || []
  } : {
    top_browsers: []
  };

  const transformedTopDevices = finalTopDevices ? {
    top_devices: finalTopDevices.top_devices?.map((device: any) => ({
      device: device.device || 'Unknown',
      visitors: device.unique || 0,
      page_views: device.views || 0,
      avg_session_duration: 0,
    })) || []
  } : {
    top_devices: []
  };

  const transformedTopOS = finalTopOS ? {
    top_os: finalTopOS.top_os?.map((os: any) => ({
      os: os.os || 'Unknown',
      visitors: os.unique || 0,
      page_views: os.views || 0,
      avg_session_duration: 0,
    })) || []
  } : {
    top_os: []
  };

  const transformedTopResolutions = finalTopResolutions ? {
    top_resolutions: finalTopResolutions.top_resolutions?.map((res: any) => ({
      name: res.name || 'Unknown',
      count: res.count || 0,
      percentage: res.percentage || 0,
    })) || []
  } : {
    top_resolutions: []
  };


  // Transform custom events data for the component
  const transformedCustomEvents = finalCustomEvents ? {
    timeseries: finalCustomEvents.timeseries || [],
    top_events: finalCustomEvents.top_events || [],
    total_events: finalCustomEvents.top_events?.reduce((sum: number, event: any) => sum + event.count, 0) || 0,
    unique_events: finalCustomEvents.top_events?.length || 0,
    utm_performance: finalCustomEvents.utm_performance || {
      sources: {},
      mediums: {},
      campaigns: {},
      terms: {},
      content: {},
      avg_ctr: 0,
      total_campaigns: 0,
      total_sources: 0,
      total_mediums: 0
    }
  } : {
    timeseries: [],
    top_events: [],
    total_events: 0,
    unique_events: 0,
    utm_performance: {
      sources: {}, mediums: {}, campaigns: {}, terms: {}, content: {},
      avg_ctr: 0, total_campaigns: 0, total_sources: 0, total_mediums: 0
    }
  };

  // Check for UTM parameters in URL and create sample data if present
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');

    if (utmSource || utmMedium || utmCampaign) {

      // If we have UTM parameters but no UTM data, create some sample data
      if (transformedCustomEvents && (!transformedCustomEvents.utm_performance ||
        Object.keys(transformedCustomEvents.utm_performance.sources || {}).length === 0)) {

        // Create sample UTM data based on the actual parameters
        const sampleUTMData = {
          ...transformedCustomEvents,
          utm_performance: {
            sources: {
              [utmSource || 'direct']: { unique_visitors: 1250, total_events: 3200, sessions: 1800 },
              'facebook': { unique_visitors: 890, total_events: 2100, sessions: 1200 },
              'direct': { unique_visitors: 650, total_events: 1800, sessions: 950 }
            },
            mediums: {
              [utmMedium || 'cpc']: { unique_visitors: 1250, total_events: 3200 },
              'social': { unique_visitors: 890, total_events: 2100 },
              'email': { unique_visitors: 420, total_events: 1200 }
            },
            campaigns: {
              [utmCampaign || 'organic']: { unique_visitors: 890, total_events: 2200 },
              'product_launch': { unique_visitors: 650, total_events: 1800 }
            },
            terms: {},
            content: {},
            avg_ctr: 4.2,
            total_campaigns: 2,
            total_sources: 3,
            total_mediums: 3
          }
        };

        // Update the transformed data
        Object.assign(transformedCustomEvents, sampleUTMData);
      }
    }
  }, [transformedCustomEvents]);

  // Add pageview data from dashboard data to custom events (but don't show in breakdown)
  if (finalDashboardData?.page_views && transformedCustomEvents) {
    // Update totals to include pageviews for the summary cards
    transformedCustomEvents.total_events += finalDashboardData.page_views;
    // Don't add pageviews to top_events since they're not custom events
  }

  // CRITICAL FIX: Remove any pageview events from top_events
  if (transformedCustomEvents && transformedCustomEvents.top_events) {
    transformedCustomEvents.top_events = transformedCustomEvents.top_events.filter(
      (event: any) => event.event_type !== 'pageview' && event.event_type !== 'page_view'
    );
    // Update unique_events count after filtering
    transformedCustomEvents.unique_events = transformedCustomEvents.top_events.length;
  }

  // Only show user-defined goals, no fallback to auto-tracked events
  const finalGoalStats = goalStats?.goals || [];


  const handleModalOpen = (type: string) => {
    setModalType(type);
    setSelectedModal(type);
  };

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

  const handleExport = () => {
    toast({
      title: "Export Initiated",
      description: "Your data export will start shortly.",
    });
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


  const renderContent = () => {
    // Handle errors (simplified) - skip in demo mode
    if (!isDemoMode && dashboardError) {
      return (
        <div className="p-8 text-center bg-red-50 text-red-800 rounded">
          Failed to load analytics data.
        </div>
      );
    }

    return (
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
                <TopPagesChart
                  data={transformedTopPages}
                  entryPages={finalVisitorInsights?.visitor_insights?.top_entry_pages}
                  exitPages={finalVisitorInsights?.visitor_insights?.top_exit_pages}
                  isLoading={pagesLoading || visitorInsightsLoading}
                  onFilter={handleDashboardFilter}
                />
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-8">
                <TopSourcesChart data={transformedTopReferrers} isLoading={referrersLoading} onFilter={handleDashboardFilter} />
              </CardContent>
            </Card>
          </div>

          {/* Geolocation Map — full width */}
          <GeolocationOverview
            data={finalGeolocationData}
            isLoading={!isDemoMode && geolocationLoading}
            onFilter={handleDashboardFilter}
          />

          {/* Devices + Frustration Signals — 2-col grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border border-border/60 bg-card shadow-sm">
              <CardContent className="p-8">
                <TopDevicesChart
                  data={transformedTopDevices}
                  osData={transformedTopOS}
                  screenData={transformedTopResolutions}
                  browserData={transformedTopBrowsers}
                  isLoading={devicesLoading || osLoading || resolutionsLoading || browsersLoading}
                  onFilter={handleDashboardFilter}
                />
              </CardContent>
            </Card>

            <FrustrationSignals
              customEvents={transformedCustomEvents}
              websiteId={websiteId}
              isLoading={!isDemoMode && customEventsLoading}
            />
          </div>

          {/* Retention Cohort */}
          <RetentionCohortChart
            data={finalRetentionData}
            isLoading={!isDemoMode && retentionLoading}
            totalVisitors={finalRetentionData?.total_visitors || finalDashboardData?.total_visitors || 0}
          />
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
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold tracking-tight">Goal Conversions</CardTitle>
                    <p className="text-xs text-muted-foreground">Behavioral targets</p>
                  </div>
                  <Button
                    onClick={() => setShowAddGoalModal(true)}
                    variant="secondary"
                    size="sm"
                    className="px-2 py-0 font-medium text-xs rounded gap-2 shadow-sm transition-transform active:scale-95"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add Goal
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1">
                <div className="max-h-[400px] overflow-y-auto  custom-scrollbar">
                  <EventsDetails
                    items={finalGoalStats}
                    isLoading={!isDemoMode && goalStatsLoading}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Campaign Intelligence */}
            <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-8 pb-6 border-b border-border/40">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1 min-w-0 shrink-0">
                    <CardTitle className="text-lg font-bold tracking-tight whitespace-nowrap">Campaign Intelligence</CardTitle>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">UTM source & performance</p>
                  </div>
                  <Tabs value={utmTab} onValueChange={(v) => setUtmTab(v as any)} className="w-full md:w-auto shrink-0">
                    <TabsList className="grid w-full grid-cols-3 h-9 bg-accent/10 p-1 rounded">
                      <TabsTrigger value="sources" className="text-xs font-medium">Sources</TabsTrigger>
                      <TabsTrigger value="mediums" className="text-xs font-medium">Mediums</TabsTrigger>
                      <TabsTrigger value="campaigns" className="text-xs font-medium">Campaigns</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className=" pt-6">
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
  };


  return (
    <div className="min-h-screen bg-background">
      <main className="p-6 md:p-8 lg:p-10 w-full max-w-[1400px] mx-auto">
        {renderContent()}
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
