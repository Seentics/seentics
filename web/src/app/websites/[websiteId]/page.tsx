'use client';

import { TrafficOverview } from '@/components/analytics/TrafficOverview';

import type { EventAnnotation } from '@/components/analytics/EventAnnotations';

import { useCustomEvents, useDailyStats, useDashboardData, useGeolocationBreakdown, useHourlyStats, useDimensionsBulk, useVisitorInsights, usePreviousPeriodDailyStats } from '@/features/analytics/queries';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { useDefaultModeRedirect } from '@/features/ai/default-mode';
import { demoAnalyticsData, demoWebsite } from '@/lib/demo';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetailedDataModal } from '@/components/analytics/DetailedDataModal';
import { SummaryCards } from '@/components/analytics/SummaryCards';

import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { ActiveFilterPills } from '@/components/analytics/ActiveFilterPills';
import { WebsiteSwitcher } from '@/components/analytics/WebsiteSwitcher';
import { AudienceSection } from '@/components/analytics/AudienceSection';
import {
  selectTopPages, selectTopReferrers, selectTopCountries, selectTopBrowsers,
  selectTopDevices, selectTopOS, selectCustomEvents,
} from '@/features/analytics/selectors';
import { FilterModal } from '@/components/analytics/FilterModal';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { ThemeToggle } from '@/components/theme-toggle';
import { WebsiteGoalsSection } from '@/components/analytics/WebsiteGoalsSection';

export default function WebsiteDashboardPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  /*
   * Honour "open this website in AI mode". `?dashboard=1` opts out for one visit, which
   * is what the AI page's own link back here uses — otherwise switching would bounce.
   */
  const searchParamsForMode = useSearchParams();
  useDefaultModeRedirect(
    websiteId,
    router.replace,
    searchParamsForMode.get('dashboard') === '1',
  );
  const { user } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedModal, setSelectedModal] = useState<string | null>(null);
  const [modalType, setModalType] = useState<string>('');
  const [showAddWebsiteModal, setShowAddWebsiteModal] = useState(false);

  // Filter state
  const [dateRange, setDateRange] = useState<number>(30);
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

  // ── PRIORITY: above-the-fold data (SummaryCards + TrafficOverview) ──
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData(websiteId, dateRange, advancedFilters);
  const { data: dailyStats, isLoading: dailyLoading } = useDailyStats(websiteId, dateRange, advancedFilters);
  const { data: hourlyStats } = useHourlyStats(websiteId, dateRange, advancedFilters);
  const { data: visitorInsights, isLoading: visitorInsightsLoading } = useVisitorInsights(websiteId, dateRange);

  const { data: dimensionsData, isLoading: dimensionsLoading, error: dimensionsError } = useDimensionsBulk(websiteId, dateRange, advancedFilters);
  const topPages     = dimensionsData ? { top_pages:     dimensionsData.top_pages }     : undefined;
  const topReferrers = dimensionsData ? { top_referrers: dimensionsData.top_referrers } : undefined;
  const topCountries = dimensionsData ? { top_countries: dimensionsData.top_countries } : undefined;
  const topBrowsers  = dimensionsData ? { top_browsers:  dimensionsData.top_browsers }  : undefined;
  const topDevices   = dimensionsData ? { top_devices:   dimensionsData.top_devices }   : undefined;
  const topOS        = dimensionsData ? { top_os:        dimensionsData.top_os }        : undefined;
  const pagesLoading    = dimensionsLoading;
  const referrersLoading = dimensionsLoading;
  const countriesLoading = dimensionsLoading;
  const browsersLoading  = dimensionsLoading;
  const devicesLoading   = dimensionsLoading;
  const osLoading        = dimensionsLoading;
  const { data: geolocationData, isLoading: geolocationLoading } = useGeolocationBreakdown(websiteId, dateRange);
  const { data: customEvents, isLoading: customEventsLoading } = useCustomEvents(websiteId, dateRange);

  // Previous period data for comparison overlay
  const { data: previousDailyStats } = usePreviousPeriodDailyStats(websiteId, dateRange, showComparison);

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

  // Reshaping lives in `features/analytics/selectors`; the page only picks the source.
  const transformedTopPages     = useMemo(() => selectTopPages(isDemoMode ? demoData?.topPages : topPages), [isDemoMode, demoData, topPages]);
  const transformedTopReferrers = useMemo(() => selectTopReferrers(isDemoMode ? demoData?.topReferrers : topReferrers), [isDemoMode, demoData, topReferrers]);
  const transformedTopBrowsers  = useMemo(() => selectTopBrowsers(isDemoMode ? demoData?.topBrowsers : topBrowsers), [isDemoMode, demoData, topBrowsers]);
  const transformedTopDevices   = useMemo(() => selectTopDevices(isDemoMode ? demoData?.topDevices : topDevices), [isDemoMode, demoData, topDevices]);
  const transformedTopOS        = useMemo(() => selectTopOS(isDemoMode ? demoData?.topOS : topOS), [isDemoMode, demoData, topOS]);
  const transformedCustomEvents = useMemo(() => selectCustomEvents(isDemoMode ? demoData?.customEvents : customEvents, finalDashboardData?.page_views ?? 0), [isDemoMode, demoData, customEvents, finalDashboardData?.page_views]);

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

  const handleWebsiteAdded = (websiteId: string) => {
    // Redirect to the newly added website
    router.push(`/websites/${websiteId}`);
  };

  const dashboardContent = !isDemoMode && dashboardError ? (
    <div className="p-8 text-center bg-red-50 text-red-800 rounded-lg">
      Failed to load analytics data.
    </div>
  ) : (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* ── Header — single compact row ── */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">

          <WebsiteSwitcher
            websites={websites}
            value={websiteId}
            onChange={(id) => router.push(`/websites/${id}`)}
            onAddWebsite={() => setShowAddWebsiteModal(true)}
          />

          {/* Spacer pushes controls to the right */}
          <div className="flex-1" />


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
          <div className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-card transition-colors hover:bg-card border dark:border-none">
            <ThemeToggle />
          </div>
        </div>

        {/* Summary cards */}
        <div>
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
          />
        </div>

        <ActiveFilterPills
          filters={advancedFilters}
          onRemove={removeFilter}
          onClearAll={() => setAdvancedFilters({})}
        />

        {/* Traffic Overview */}
        <section>
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
        <AudienceSection
          pages={{
            data: transformedTopPages,
            entryPages: finalVisitorInsights?.visitor_insights?.top_entry_pages,
            exitPages: finalVisitorInsights?.visitor_insights?.top_exit_pages,
            isLoading: pagesLoading || visitorInsightsLoading,
          }}
          sources={{ data: transformedTopReferrers, isLoading: referrersLoading }}
          geolocation={{ data: finalGeolocationData, isLoading: !isDemoMode && geolocationLoading }}
          devices={{
            data: transformedTopDevices,
            osData: transformedTopOS,
            browserData: transformedTopBrowsers,
            isLoading: devicesLoading || osLoading || browsersLoading,
          }}
          utm={{
            data: transformedCustomEvents.utm_performance,
            tab: utmTab,
            onTabChange: setUtmTab,
            isLoading: customEventsLoading,
          }}
          footer={
            <ChartErrorBoundary label="Goals">
              <WebsiteGoalsSection websiteId={websiteId} days={dateRange} />
            </ChartErrorBoundary>
          }
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

    </div>
  );
}
