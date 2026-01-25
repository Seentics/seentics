//@ts-ignore
'use client';

import { GeolocationOverview } from '@/components/analytics/GeolocationOverview';
import { TopCountriesChart } from '@/components/analytics/TopCountriesChart';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TrafficOverview } from '@/components/analytics/TrafficOverview';
import { UTMPerformanceChart } from '@/components/analytics/UTMPerformanceChart';
import { VisitorInsightsCard } from '@/components/analytics/VisitorInsightsCard';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WebsitesHeader } from '@/components/websites/websites-header';
import { DashboardFooter } from '@/components/websites/dashboard-footer';
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
  useTopPages,
  useTopReferrers,
  useUserRetention,
  useVisitorInsights,
} from '@/lib/analytics-api';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { format } from 'date-fns';
import { getDemoData, getDemoWebsite } from '@/lib/demo-data';
import { CalendarIcon, Download, Globe, PlusCircle, Target } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { DetailedDataModal } from '@/components/analytics/DetailedDataModal';
import { EventsDetails } from '@/components/analytics/EventsDetails';
import { SummaryCards } from '@/components/analytics/SummaryCards';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { LandingExitAnalysis } from '@/components/analytics/LandingExitAnalysis';
import { AutomationInsightTable } from '@/components/analytics/AutomationSynergyChart';

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


  // Filter state
  const [dateRange, setDateRange] = useState<number>(7);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [utmTab, setUtmTab] = useState<'sources' | 'mediums' | 'campaigns' | 'terms' | 'content'>('sources');

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

  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData(websiteId, dateRange);
  const { data: topPages, isLoading: pagesLoading, error: pagesError } = useTopPages(websiteId, dateRange);
  const { data: topReferrers, isLoading: referrersLoading, error: referrersError } = useTopReferrers(websiteId, dateRange);
  const { data: topCountries, isLoading: countriesLoading, error: countriesError } = useTopCountries(websiteId, dateRange);
  const { data: topBrowsers, isLoading: browsersLoading, error: browsersError } = useTopBrowsers(websiteId, dateRange);
  const { data: topDevices, isLoading: devicesLoading, error: devicesError } = useTopDevices(websiteId, dateRange);
  const { data: topOS, isLoading: osLoading, error: osError } = useTopOS(websiteId, dateRange);
  const { data: dailyStats, isLoading: dailyLoading, error: dailyError } = useDailyStats(websiteId, dateRange);
  
  // Note: trafficSummaryChart removed - use dailyStats for chart data instead
  const trafficSummaryChart = isDemoMode ? demoData?.dailyStats : dailyStats;
  const trafficChartLoading = isDemoMode ? false : dailyLoading;

  const { data: customEvents, isLoading: customEventsLoading } = useCustomEvents(websiteId, dateRange);
  const { data: hourlyStats, isLoading: hourlyLoading } = useHourlyStats(websiteId, dateRange);
  const { data: geolocationData, isLoading: geolocationLoading, error: geolocationError } = useGeolocationBreakdown(websiteId, dateRange);
  const { data: visitorInsights, isLoading: visitorInsightsLoading } = useVisitorInsights(websiteId, dateRange);


  // Fetch activity trends data
  const { data: activityTrends, isLoading: trendsLoading, error: trendsError } = useActivityTrends(websiteId);

  // Fetch retention data
  const { data: retentionData, isLoading: retentionLoading } = useUserRetention(websiteId, dateRange);

  // Use demo data when in demo mode, otherwise use API data
  const finalDashboardData = isDemoMode ? demoData?.dashboardData : dashboardData;
  const finalTopPages = isDemoMode ? demoData?.topPages : topPages;
  const finalTopReferrers = isDemoMode ? demoData?.topReferrers : topReferrers;
  const finalTopCountries = isDemoMode ? demoData?.topCountries : topCountries;
  const finalTopBrowsers = isDemoMode ? demoData?.topBrowsers : topBrowsers;
  const finalTopDevices = isDemoMode ? demoData?.topDevices : topDevices;
  const finalTopOS = isDemoMode ? demoData?.topOS : topOS;
  const finalDailyStats = isDemoMode ? demoData?.dailyStats : dailyStats;
  const finalHourlyStats = isDemoMode ? demoData?.hourlyStats : hourlyStats;
  const finalGeolocationData = isDemoMode ? demoData?.geolocationData : geolocationData;
  const finalVisitorInsights = isDemoMode ? demoData?.visitorInsights : visitorInsights;
  const finalCustomEvents = isDemoMode ? demoData?.customEvents : customEvents;
  const finalActivityTrends = isDemoMode ? demoData?.activityTrends : activityTrends;
  const finalRetentionData = isDemoMode ? demoData?.retentionData : retentionData;

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
    if (!isDemoMode && dashboardLoading) {
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                  <CardHeader className="pb-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      }
    
      // Handle errors (simplified) - skip in demo mode
      if (!isDemoMode && dashboardError) {
        return (
          <div className="p-8 text-center bg-red-50 text-red-800 rounded-lg">
             Failed to load analytics data.
          </div>
        );
      }

      return (
        <div className="space-y-6">
        {/* Header Section inside Content (Title + Filters) */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-center gap-2">
                 {/* Demo Mode Badge */}
                 {isDemoMode && (
                   <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium border border-blue-500/20">
                     <span className="font-semibold">DEMO</span>
                   </div>
                 )}
                 {/* Live Visitors Badge - Standalone */}
                 <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium border border-green-500/20">
                    <span className="relative flex h-2.5 w-2.5 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    {finalDashboardData?.live_visitors || 0} current visitors
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Website Switcher */}
             <div className="w-full sm:w-[200px]">
                <Select value={websiteId} onValueChange={handleWebsiteChange}>
                    <SelectTrigger className="w-full bg-secondary text-secondary-foreground border-0 hover:bg-secondary/80">
                        <div className="flex items-center truncate">
                             <Globe className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate">{currentWebsite?.name || 'Select website'}</span>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {websites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                                {site.name}
                            </SelectItem>
                        ))}
                        {websites.length > 0 && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <SelectItem value="add-new" className="text-primary">
                              <div className="flex items-center">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Website
                              </div>
                            </SelectItem>
                          </>
                        )}
                    </SelectContent>
                </Select>
             </div>

            {/* Date Range Filter */}
            <Select value={isCustomRange ? 'custom' : dateRange.toString()} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="w-full sm:w-40 bg-secondary text-secondary-foreground border-0 hover:bg-secondary/80">
                <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="1">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
            </Select>

            {/* Custom Date Range Picker */}
            {isCustomRange && (
                <Popover>
                <PopoverTrigger asChild>
                    <Button variant="secondary" size="sm" className="w-full sm:w-48 h-9 justify-start text-left font-normal border-0">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate && customEndDate ? (
                        `${format(customStartDate, 'MMM dd')} - ${format(customEndDate, 'MMM dd, yyyy')}`
                    ) : (
                        'Pick a date range'
                    )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customStartDate}
                    selected={{ from: customStartDate, to: customEndDate }}
                    onSelect={(range) => { handleCustomDateChange(range?.from, range?.to); }}
                    numberOfMonths={window.innerWidth < 768 ? 1 : 2}
                    />
                </PopoverContent>
                </Popover>
            )}

            {/* Export Data Button */}
            <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0 border-0" onClick={handleExport} title="Export Data">
                <Download className="h-4 w-4" />
            </Button>
            </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards
            data={finalDashboardData || {
            total_visitors: 0,
            unique_visitors: 0,
            live_visitors: 0,
            page_views: 0,
            session_duration: 0,
            bounce_rate: 0,
            comparison: {}
            }}
        />


        {/* Traffic Overview */}
        <TrafficOverview
            dailyStats={trafficSummaryChart || finalDailyStats}
            hourlyStats={finalHourlyStats}
            isLoading={!isDemoMode && (dashboardLoading || dailyLoading || trafficChartLoading)}
            className="border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none bg-white dark:bg-gray-800 rounded-md"
        />


        {/* Row 4: Map */}
         <GeolocationOverview
            data={finalGeolocationData}
            isLoading={!isDemoMode && geolocationLoading}
        />


        {/* DETAILS GRID START */}
        
        {/* Row 1: Top Pages & Top Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md">
                <CardContent className="p-6">
                    <TopPagesChart 
                        data={transformedTopPages} 
                        entryPages={finalVisitorInsights?.visitor_insights?.top_entry_pages}
                        exitPages={finalVisitorInsights?.visitor_insights?.top_exit_pages}
                        isLoading={pagesLoading || visitorInsightsLoading} 
                    />
                </CardContent>
            </Card>

            <Card className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md">
                <CardContent className="p-6">
                    <TopSourcesChart data={transformedTopReferrers} isLoading={referrersLoading} />
                </CardContent>
            </Card>
        </div>

        {/* Row 2: System Insights & Goal Conversions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* System Insights */}
             <Card className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md">
                <CardContent className="p-6">
                    <TopDevicesChart 
                        data={transformedTopDevices} 
                        osData={transformedTopOS}
                        isLoading={devicesLoading || osLoading} 
                    />
                </CardContent>
            </Card>

            {/* Goal Conversions (Events) */}
            <Card className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md">
              <CardHeader className="bg-muted/10 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">Goal Conversions</CardTitle>
                      <p className="text-xs text-muted-foreground">Custom events tracked on your site</p>
                    </div>
                    {/* <div className="p-2 rounded-lg bg-background border shadow-sm">
                      <Target className="h-4 w-4 text-purple-500" />
                    </div> */}
                  </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-h-[380px] overflow-y-auto pr-1">
                  <EventsDetails
                  items={(transformedCustomEvents.top_events as any[])
                      .filter(e => !['pageview', 'page_view', 'page_visible', 'page_hidden', 'exit_intent'].includes(e.event_type))}
                  />
                </div>
              </CardContent>
            </Card>
        </div>
        
      

        {/* Row 5: UTM Marketing Performance */}
        <div className="grid grid-cols-1 gap-6">

            <Card className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md overflow-hidden">
                <CardHeader className="bg-muted/10 pb-4 border-b">
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-semibold">UTM & Marketing</CardTitle>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">Campaign and traffic source performance</p>
                        </div>
                        <Tabs value={utmTab} onValueChange={(v) => setUtmTab(v as any)} className="w-full sm:w-auto">
                            <TabsList className="grid w-full grid-cols-5 h-9 sm:h-9">
                                <TabsTrigger value="sources" className="text-xs px-1 font-semibold">Sources</TabsTrigger>
                                <TabsTrigger value="mediums" className="text-xs px-1 font-semibold">Mediums</TabsTrigger>
                                <TabsTrigger value="campaigns" className="text-xs px-1 font-semibold">Campaigns</TabsTrigger>
                                <TabsTrigger value="terms" className="text-xs px-1 font-semibold">Terms</TabsTrigger>
                                <TabsTrigger value="content" className="text-xs px-1 font-semibold">Content</TabsTrigger>
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

        {/* Row 6: Workflow Automation Synergy */}
        <AutomationInsightTable 
            data={finalDailyStats} 
            isLoading={dailyLoading} 
        />


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
    <div className="min-h-screen">
      <WebsitesHeader />
      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {renderContent()}
      </main>
      <DashboardFooter />
      
      {/* Add Website Modal */}
      <AddWebsiteModal 
        open={showAddWebsiteModal} 
        onOpenChange={setShowAddWebsiteModal}
        onSuccess={handleWebsiteAdded}
      />
    </div>
  );
}
