'use client';

import { TrafficOverview } from '@/components/analytics/TrafficOverview';

import type { EventAnnotation } from '@/components/analytics/EventAnnotations';

import { useCustomEvents, useDailyStats, useDashboardData, useGeolocationBreakdown, useHourlyStats, useDimensionsBulk, useVisitorInsights, usePreviousPeriodDailyStats } from '@/features/analytics/queries';
import { customRange, presetRange } from '@/features/analytics/range';
import { getWebsites, Website } from '@/lib/websites-api';
import { useAuth } from '@/stores/useAuthStore';
import { useDefaultModeRedirect } from '@/features/ai/default-mode';
import { demoAnalyticsData, demoWebsite } from '@/lib/demo';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SummaryCards } from '@/components/analytics/SummaryCards';

import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { ActiveFilterPills } from '@/components/analytics/ActiveFilterPills';
import { WebsiteSwitcher } from '@/components/analytics/WebsiteSwitcher';
import { AudienceSection } from '@/components/analytics/AudienceSection';
import { AiModeButton } from '@/components/ai/AiModeButton';
import { useClientMode } from '@/features/client-mode/ClientMode';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { askAbout } from '@/features/ai/ask-link';
import {
  selectTopPages, selectTopReferrers, selectTopCountries, selectTopBrowsers,
  selectTopDevices, selectTopOS, selectCustomEvents,
} from '@/features/analytics/selectors';
import { FilterModal } from '@/components/analytics/FilterModal';
import { DateRangeButton } from '@/components/analytics/DateRangeButton';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';
import { ThemeToggle } from '@/components/theme-toggle';
import { WebsiteGoalsSection } from '@/components/analytics/WebsiteGoalsSection';
import { forgetWebsite, rememberedWebsite, rememberWebsite } from '@/lib/last-website';
import { useNearViewport } from '@/hooks/use-near-viewport';
import { AiBrief } from '@/components/ai/AiBrief';
import { useT } from '@/lib/i18n';

export interface WebsiteOverviewProps {
  websiteId: string;
  /**
   * Rendered inside someone else's page (`/embed/…`): read-only, no sign-in, no navigation, no
   * writes, and the address bar is left alone because it carries the embed link's secret.
   */
  embed?: boolean;
  /** Show the demo data, for sample embed links. */
  sample?: boolean;
  /** Replaces the website switcher in the header row (the embed shows a name, or a client's switcher). */
  headerLeft?: React.ReactNode;
}

/** The website's analytics overview: the signed-in page, and the same page when embedded. */
export function WebsiteOverview({ websiteId, embed = false, sample = false, headerLeft }: WebsiteOverviewProps) {
  const router = useRouter();
  const t = useT().analytics;
  const askT = useT().ai.ask;

  /*
   * Open in AI mode when that is this website's default (see `features/ai/default-mode`).
   * `?dashboard=1` opts out for one visit, which is what every link meant to land on the
   * dashboard uses — otherwise switching would bounce. Embeds and the demo never move.
   * While the answer is pending the dashboard is held back, so it does not flash first.
   */
  const searchParamsForMode = useSearchParams();
  // Client mode: the switcher lists the client's websites, and AI shows only where it is allowed.
  const clientMode = useClientMode();
  const client = !embed && clientMode?.access.isClient ? clientMode.access : null;
  const isClientMode = Boolean(client);
  const clientAi = client ? client.canSee('ai') : true;
  const landing = useDefaultModeRedirect(
    websiteId,
    router.replace,
    embed || sample || websiteId === 'demo' || searchParamsForMode.get('dashboard') === '1' || !clientAi,
  );
  const { user } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
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
    if (!websiteId || embed) return;
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
    if (!websiteId || embed) return;
    localStorage.setItem(`annotations-${websiteId}`, JSON.stringify(annotations));
  }, [annotations, websiteId, embed]);

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
    if (typeof window === 'undefined' || embed) return;
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
  }, [dateRange, advancedFilters, embed]);

  // Check if we're in demo mode
  const isDemoMode = websiteId === 'demo' || sample;
  // AI entry points need a real, signed-in website: not an embed, not the demo.
  // The demo shows the AI too, from fixtures (lib/demo/ai); only embeds leave it out.
  const showAi = !embed && clientAi;
  const ask = (about: { question: string; context: string }) => (
    showAi ? <AskAiButton websiteId={websiteId} question={about.question} context={about.context} /> : undefined
  );

  // Fetch websites for switcher
  useEffect(() => {
    if (embed || isClientMode) return;
    const loadWebsites = async () => {
      if (user) {
        try {
          const data = await getWebsites();
          // Add demo website to the list if in demo mode
          if (isDemoMode) {
            setWebsites([demoWebsite(), ...data]);
          } else {
            setWebsites(data);
            // /websites goes straight to the site remembered here; one that is gone (deleted,
            // access removed) is forgotten and the visitor sent back to pick another.
            if (data.some((website) => website.id === websiteId)) rememberWebsite(websiteId);
            else if (rememberedWebsite() === websiteId) {
              forgetWebsite();
              router.replace('/websites');
            }
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
  }, [user, isDemoMode, websiteId, router, embed, isClientMode]);

  /*
   * What every read below asks for. Today and the last N days are `days`; Yesterday and a
   * picked range are their own dates (`features/analytics/range`). A custom range used to be
   * sent as "the last N days ending now", whatever days were picked.
   */
  const customStartKey = customStartDate?.getTime();
  const customEndKey = customEndDate?.getTime();
  const range = useMemo(
    () => (isCustomRange && customStartDate && customEndDate ? customRange(customStartDate, customEndDate) : presetRange(dateRange)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCustomRange, customStartKey, customEndKey, dateRange],
  );

  // ── PRIORITY: above-the-fold data (SummaryCards + TrafficOverview) ──
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useDashboardData(websiteId, range, advancedFilters);
  const { data: dailyStats, isLoading: dailyLoading } = useDailyStats(websiteId, range, advancedFilters);
  const { data: hourlyStats, isLoading: hourlyLoading } = useHourlyStats(websiteId, range, advancedFilters);

  // ── DEFERRED: everything below the traffic chart ──
  // Asked for once the cards and chart have their answers and the section is near the screen.
  // All nine reads used to leave together and queue behind each other on the server, so the
  // cards waited on the map. Once released the section stays released: a new range or filter
  // refetches it with the rest instead of waiting again.
  const audienceRef = useRef<HTMLDivElement>(null);
  const audienceNear = useNearViewport(audienceRef);
  const priorityDone = !dashboardLoading && !dailyLoading && !hourlyLoading;
  const [belowFoldReleased, setBelowFoldReleased] = useState(false);
  if (priorityDone && audienceNear && !belowFoldReleased) setBelowFoldReleased(true);
  const loadBelowFold = belowFoldReleased && !isDemoMode;

  // `isPending` rather than `isLoading`: a read still held back has no data and is not
  // loading, and its panel should show the skeleton, not "no data".
  const { data: visitorInsights, isPending: visitorInsightsLoading } = useVisitorInsights(websiteId, range, loadBelowFold, advancedFilters);
  const { data: dimensionsData, isPending: dimensionsLoading } = useDimensionsBulk(websiteId, range, advancedFilters, loadBelowFold);
  const topPages     = dimensionsData ? { top_pages:     dimensionsData.top_pages }     : undefined;
  const topReferrers = dimensionsData ? { top_referrers: dimensionsData.top_referrers } : undefined;
  const topBrowsers  = dimensionsData ? { top_browsers:  dimensionsData.top_browsers }  : undefined;
  const topDevices   = dimensionsData ? { top_devices:   dimensionsData.top_devices }   : undefined;
  const topOS        = dimensionsData ? { top_os:        dimensionsData.top_os }        : undefined;
  const pagesLoading    = !isDemoMode && dimensionsLoading;
  const { data: geolocationData, isPending: geolocationLoading } = useGeolocationBreakdown(websiteId, range, loadBelowFold, advancedFilters);
  const { data: customEvents, isPending: customEventsLoading } = useCustomEvents(websiteId, range, loadBelowFold, advancedFilters);

  // Previous period data for comparison overlay
  const { data: previousDailyStats } = usePreviousPeriodDailyStats(websiteId, range, showComparison, advancedFilters);

  // Memoize demo data so demoAnalyticsData() is not called on every render
  const demoData = useMemo(() => (isDemoMode ? demoAnalyticsData() : null), [isDemoMode]);

  // Use demo data when in demo mode, otherwise use API data
  const finalDashboardData = isDemoMode ? demoData?.dashboardData : dashboardData;
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
    // The reads use the dates themselves (`range` above); the day count is for the labels
    // and the AI prompts that speak in days. Both ends count, so one picked day is 1, not 0.
    if (start && end) setDateRange(customRange(start, end).days);
  };

  const handleWebsiteAdded = (websiteId: string) => {
    // Redirect to the newly added website
    router.push(`/websites/${websiteId}`);
  };

  const dashboardContent = !isDemoMode && dashboardError ? (
    <div className="p-8 text-center bg-red-50 text-red-800 rounded-lg">
      {t.overview.loadFailed}
    </div>
  ) : (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* ── Header — single compact row ── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">

          {embed ? headerLeft : (
            <WebsiteSwitcher
              websites={client ? client.websites : websites}
              value={websiteId}
              onChange={(id) => router.push(`/websites/${id}`)}
              onAddWebsite={client ? undefined : () => setShowAddWebsiteModal(true)}
            />
          )}

          {/* Spacer pushes controls to the right */}
          <div className="flex-1" />

          {!embed && clientAi && <AiModeButton websiteId={websiteId} />}

          {/* Date range — shows the real dates; the Filters dialog edits the same state */}
          <DateRangeButton
            dateRange={dateRange}
            isCustomRange={isCustomRange}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onDateRangeChange={handleDateRangeChange}
            onCustomDateChange={handleCustomDateChange}
          />

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

{/* Theme — same ghost look as the other row controls. An embed takes its theme from its link. */}
          {!embed && (
            <div className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-transparent transition-colors hover:bg-muted/60">
              <ThemeToggle />
            </div>
          )}
        </div>

        {/* The AI's read in at most three lines; alerts, insight and recommendations behind "Details" */}
        {showAi && <AiBrief websiteId={websiteId} />}

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
          label={t.filters.activeLabel}
          clearAllLabel={t.filters.clearAll}
          filters={advancedFilters}
          onRemove={removeFilter}
          onClearAll={() => setAdvancedFilters({})}
        />

        {/* Traffic Overview */}
        <section>
          <ChartErrorBoundary label={t.sections.trafficOverview}>
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
              headerAction={ask(askAbout.traffic(dateRange, askT))}
            />
          </ChartErrorBoundary>
        </section>

        {/* AUDIENCE INTELLIGENCE */}
        <div ref={audienceRef}>
        <AudienceSection
          pages={{
            data: transformedTopPages,
            entryPages: finalVisitorInsights?.visitor_insights?.top_entry_pages,
            exitPages: finalVisitorInsights?.visitor_insights?.top_exit_pages,
            isLoading: pagesLoading || (!isDemoMode && visitorInsightsLoading),
          }}
          sources={{ data: transformedTopReferrers, isLoading: pagesLoading }}
          geolocation={{ data: finalGeolocationData, isLoading: !isDemoMode && geolocationLoading }}
          devices={{
            data: transformedTopDevices,
            osData: transformedTopOS,
            browserData: transformedTopBrowsers,
            isLoading: pagesLoading,
          }}
          utm={{
            data: transformedCustomEvents.utm_performance,
            tab: utmTab,
            onTabChange: setUtmTab,
            isLoading: !isDemoMode && customEventsLoading,
          }}
          headerActions={showAi ? {
            pages: ask(askAbout.pages(dateRange, askT)),
            sources: ask(askAbout.sources(dateRange, askT)),
            geolocation: ask(askAbout.geography(dateRange, askT)),
            devices: ask(askAbout.devices(dateRange, askT)),
            utm: ask(askAbout.utm(dateRange, askT)),
          } : undefined}
          footer={embed ? undefined : (
            <ChartErrorBoundary label={t.sections.goals}>
              <WebsiteGoalsSection websiteId={websiteId} range={range} filters={advancedFilters} enabled={belowFoldReleased} />
            </ChartErrorBoundary>
          )}
        />
        </div>

      </div>
  );

  return (
    <div className="min-h-0 w-full bg-background">
      <div className={embed ? "w-full p-3" : "mx-auto w-full max-w-[1200px] p-4 md:p-5 lg:px-6 lg:py-5"}>
        {/* Blank rather than a skeleton: it is usually a single tick, or a redirect away. */}
        {landing.pending ? null : dashboardContent}
      </div>

      {/* Add Website Modal */}
      {!embed && (
        <AddWebsiteModal
          open={showAddWebsiteModal}
          onOpenChange={setShowAddWebsiteModal}
          onSuccess={handleWebsiteAdded}
        />
      )}

    </div>
  );
}
