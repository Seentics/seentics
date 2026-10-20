'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, MousePointer, RefreshCw, Image as ImageIcon, TrendingDown, Layers, Link2, MoreHorizontal, Camera, Lightbulb } from 'lucide-react';

import { isDemo } from '@/lib/demo';
import { demoHeatmapPages, demoHeatmapPoints } from '@/lib/demo/heatmaps';
import { getHeatmapData, getHeatmapPageScreenshot, triggerPlaywrightScreenshot, heatmapPathFromSlug, weightedHeatmapCaptureViewportWidth, type HeatmapPoint as ApiHeatmapPoint } from '@/lib/heatmaps-api';
import { DEFAULT_HEATMAP_DAYS, HEATMAP_RANGES } from '@/features/heatmaps/api';
import { useSearchParams } from 'next/navigation';
import { useAppNavigation } from '@/lib/embed-nav';
import {
  clampLayoutPx,
  heatmapCaptureBox,
  heatmapPreviewScale,
  HEATMAP_DIM_CAP,
  MIN_CAPTURE_PX,
} from '@/lib/heatmaps/preview-geometry';
import { normalizeWebsiteOriginForPreview } from '@/lib/website-preview-url';
import { getWebsiteByAnyId } from '@/lib/websites-api';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { RangeSelect } from '@/components/ui/range-select';
import { getPageIcon } from '@/components/analytics/page-icon';

import { HeatmapViewer, DemoHeatmapStage, type PreviewUnderlay } from '@/components/heatmaps/HeatmapViewer';
import { HeatmapInsightsPanel } from '@/components/heatmaps/HeatmapInsightsPanel';
import { isAbsoluteHttpUrl, heatmapPageHeading, scrollReachPoints, type HeatType, type DeviceType, type HeatPoint } from '@/features/heatmaps/preview-math';

export default function HeatmapDetailPage() {
  return <HeatmapDetailView />;
}

/**
 * One page's heatmap: the signed-in page, and the same page inside an embed. An embed names its
 * own site and page, takes the site's address from its link, and cannot capture screenshots.
 */
export function HeatmapDetailView({ websiteId: websiteIdProp, slug: slugProp, embed = false, siteUrl }: {
  websiteId?: string;
  slug?: string;
  embed?: boolean;
  siteUrl?: string;
}) {
  const siteSegment = usePathSegment(1);
  const slugSegment = usePathSegment(3);
  const router     = useAppNavigation();
  const websiteId  = websiteIdProp ?? siteSegment ?? '';
  const slug       = slugProp ?? slugSegment ?? '';
  const isDemoMode = isDemo(websiteId);
  const { toast }  = useToast();
  const messages = useT();
  const m = messages.heatmaps;
  const t = m.detail;
  const ranges = HEATMAP_RANGES.map((r) => ({ days: r.days, label: m.ranges[`d${r.days}` as keyof typeof m.ranges] ?? r.label }));

  const queryClient = useQueryClient();

  const [heatType,  setHeatType]  = useState<HeatType>('click');
  const [device,    setDevice]    = useState<DeviceType>('all');
  // Carried in `?days=` so the list's range follows into a page, and back.
  const searchParams = useSearchParams();
  const [days, setDaysState] = useState<number>(() => {
    const n = Number(searchParams.get('days'));
    return HEATMAP_RANGES.some(r => r.days === n) ? n : DEFAULT_HEATMAP_DAYS;
  });
  const setDays = (next: number) => {
    setDaysState(next);
    if (embed) return; // the address carries the embed link's secret: leave it alone
    const url = new URL(window.location.href);
    if (next === DEFAULT_HEATMAP_DAYS) url.searchParams.delete('days');
    else url.searchParams.set('days', String(next));
    window.history.replaceState(null, '', url.toString());
  };
  const [customUrl, setCustomUrl] = useState('');
  const [previewTouched, setPreviewTouched] = useState(false);
  const [previewUnderlay, setPreviewUnderlay] = useState<PreviewUnderlay>('screenshot');
  const [capturing, setCapturing] = useState(false);
  const [previewPopoverOpen, setPreviewPopoverOpen] = useState(false);
  // Insights read the signed-in API, so an embed (no session) and the demo go without.
  const [insightsOpen, setInsightsOpen] = useState(true);
  const insightsAvailable = !embed;

  const urlPath = useMemo(() => heatmapPathFromSlug(slug), [slug]);

  const isParamPath = urlPath.includes(':id');

  const demoPages = isDemoMode ? demoHeatmapPages() : [];
  const demoPage  = demoPages.find(p => p.url === urlPath) ?? demoPages[0];

  const { data: fetchedMeta } = useQuery({
    queryKey:  ['website-meta', websiteId],
    queryFn:   () => getWebsiteByAnyId(websiteId),
    enabled:   !!websiteId && !isDemoMode && !embed,
    staleTime: 300_000,
  });
  // An embed has no account session to read the website with; its link supplies the address.
  const websiteMeta = embed ? (siteUrl ? { url: siteUrl, heatmapLayoutEnabled: undefined } : undefined) : fetchedMeta;

  const sitePreviewBase = useMemo(() => {
    const u = websiteMeta?.url?.trim();
    if (!u) return '';
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    return normalizeWebsiteOriginForPreview(u, appOrigin);
  }, [websiteMeta]);

  const suggestedPreviewUrl = useMemo(() => {
    if (!sitePreviewBase) return '';
    // urlPath may contain `:id` placeholders from path normalization (e.g. /replays/:id).
    // A URL with `:id` is not a real page — skip the suggestion so the user enters a specific URL.
    if (urlPath.includes(':id')) return '';
    const p = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
    return `${sitePreviewBase}${p}`;
  }, [sitePreviewBase, urlPath]);

  const { data: heatmapData, isLoading, isError, error, refetch } = useQuery({
    queryKey:  ['heatmap-data', websiteId, urlPath, heatType, days],
    queryFn:   () => getHeatmapData(websiteId, urlPath, heatType === 'scroll' ? 'scroll' : 'click', days),
    // Not before the website id is known: an empty one requested `/heatmaps//data`.
    enabled:   Boolean(websiteId && !isDemoMode),
    staleTime: 60_000,
  });

  // Keyed by device: backgrounds are stored per bucket because a responsive page
  // reflows between them, and the points drawn on one cannot be drawn on another.
  const { data: pageScreenshot, isLoading: screenshotLoading } = useQuery({
    queryKey:  ['heatmap-screenshot', websiteId, urlPath, device],
    queryFn:   () => getHeatmapPageScreenshot(websiteId, urlPath, device),
    enabled:   Boolean(websiteId && !isDemoMode),
    staleTime: 180_000,
    refetchOnWindowFocus: false,
    // Poll every 5s while null — server fires auto-capture in background on miss.
    // Stop after ~60s to avoid infinite polling when Playwright is unavailable.
    refetchInterval: (q) => {
      if (q.state.data) return false;
      const age = Date.now() - (q.state.dataUpdatedAt ?? Date.now());
      return age < 60_000 ? 5_000 : false;
    },
  });

  const layoutCaptureOff = websiteMeta?.heatmapLayoutEnabled === false;

  const previewModeOptions = useMemo(() => {
    const pageHint = pageScreenshot
      ? t.hintCaptured
      : screenshotLoading
        ? t.hintCapturing
        : layoutCaptureOff
          ? t.hintLayoutOff
          : t.hintNone;
    return [
      ['screenshot', ImageIcon, t.screenshot, pageHint] as const,
      ['heat-only', Layers, t.heatOnly, t.heatOnlyHint] as const,
    ];
  }, [pageScreenshot, screenshotLoading, layoutCaptureOff, t]);

  const demoPointsNormalized: HeatPoint[] = useMemo(() => {
    const raw = demoHeatmapPoints(heatType === 'scroll' ? 'move' : 'click');
    return raw.map(p => ({
      nx:        p.x / 1280,
      ny:        p.y / 2400,
      intensity: p.intensity,
      device:    'desktop',
    }));
  }, [heatType]);

  const allPoints: HeatPoint[] = isDemoMode
    ? demoPointsNormalized
    : (heatmapData?.points ?? []).map((p: ApiHeatmapPoint) => ({
        nx: p.x_percent / 10000,
        ny:
          (p.event_type || heatType) === 'scroll'
            ? Math.min(1, Math.max(0, (p.y_percent ?? 0) / 100))
            : (p.y_percent ?? 0) / 10000,
        intensity: p.intensity,
        selector:  p.target_selector || undefined,
        device:    p.device_type || 'desktop',
        cap_vw:    p.cap_vw ?? undefined,
        cap_vh:    p.cap_vh ?? undefined,
        pageVersion: p.page_version || undefined,
        locator: p.target_locator ?? undefined,
        relativeX: p.relative_x ?? undefined,
        relativeY: p.relative_y ?? undefined,
        positionMode: p.position_mode ?? 'normal',
        mappingMethod: p.target_locator ? 'coordinate' : undefined,
      }));

  const preferredViewportWidth = useMemo(() => {
    if (isDemoMode) return null;
    const src =
      device === 'all'
        ? (heatmapData?.points ?? [])
        : (heatmapData?.points ?? []).filter(
            p => (p.device_type || 'desktop').toLowerCase() === device,
          );
    return weightedHeatmapCaptureViewportWidth(src);
  }, [heatmapData, device, isDemoMode]);

  const devicePoints: HeatPoint[] = device === 'all'
    ? allPoints
    : allPoints.filter(p => (p.device ?? 'desktop').toLowerCase() === device);
  const points: HeatPoint[] = heatType === 'scroll'
    ? scrollReachPoints(devicePoints)
    : devicePoints;

  const activePreviewUrl = (customUrl.trim() || suggestedPreviewUrl).trim();

  const captureScreenshot = async () => {
    const url = activePreviewUrl;
    if (!url || capturing) return;
    if (!isAbsoluteHttpUrl(url)) {
      toast({ title: t.noPreviewUrl, description: t.noPreviewUrlBody, variant: 'destructive' });
      return;
    }
    setCapturing(true);
    try {
      const result = await triggerPlaywrightScreenshot(websiteId, url, urlPath, { force: true });
      if (!result) throw new Error(t.captureFailedReach);
      await queryClient.invalidateQueries({ queryKey: ['heatmap-screenshot', websiteId, urlPath] });
      setPreviewTouched(true);
      setPreviewUnderlay('screenshot');
      toast({ title: t.captured, description: t.capturedBody });
    } catch (e) {
      toast({ title: t.captureFailed, description: (e as Error).message ?? String(e), variant: 'destructive' });
    } finally {
      setCapturing(false);
    }
  };

  const applyUrl = () => {
    const t = customUrl.trim();
    if (!t) return;
    setPreviewTouched(true);
    setCustomUrl(t.startsWith('http') ? t : `https://${t}`);
  };

  const resetPreviewUrl = () => {
    setPreviewTouched(false);
    setCustomUrl('');
  };


  const pathForHeading = isDemoMode ? (demoPage?.url ?? urlPath) : urlPath;
  const { subtitle: pageSubtitle } = heatmapPageHeading(
    pathForHeading || '/',
    isDemoMode ? undefined : websiteId,
  );
  const heatmapPathLine = (() => {
    const p = (urlPath || '').trim() || pageSubtitle || '/';
    return p.startsWith('/') ? p : `/${p}`;
  })();

  const previewUrlPopoverInner = (
    <>
      {isParamPath && (
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
          {t.paramPathPopover(
            <span key="p" className="font-medium">{t.paramPath}</span>,
            <code key="e" className="font-mono">{urlPath.replace(/:id/g, 'abc123')}</code>,
          )}
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-foreground">{t.previewUrl}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.previewUrlHint}
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyUrl()}
          placeholder={suggestedPreviewUrl || 'https://…'}
          className="h-9 font-mono text-xs"
        />
        <Button type="button" size="sm" className="h-9 shrink-0" onClick={applyUrl}>
          {t.apply}
        </Button>
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={resetPreviewUrl}>
        {t.resetSuggested}
      </Button>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {isError && !isDemoMode && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {(error as Error)?.message ?? t.loadFailed}
        </div>
      )}

      <header className="shrink-0 border-b border-border bg-background">
        <div
          className="mx-auto flex max-w-[1800px] items-center gap-2 overflow-x-auto px-2 py-1.5 md:px-4"
          role="toolbar"
          aria-label={t.toolbar}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push(`/websites/${websiteId}/heatmaps`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.back}
          </Button>
          {isDemoMode ? (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] font-medium">
              {t.demo}
            </Badge>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
            {points.length > 0 ? (
              <span className="shrink-0 tabular-nums">{t.pts(points.length.toLocaleString())}</span>
            ) : null}
            {points.length > 0 ? <span className="shrink-0 text-border" aria-hidden>·</span> : null}
            <span className="shrink-0">{getPageIcon(pathForHeading, 'h-4 w-4')}</span>
            <code className="min-w-0 truncate font-mono text-xs text-foreground" title={heatmapPathLine}>
              {heatmapPathLine}
            </code>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {insightsAvailable && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(GHOST_CONTROL, 'h-8 w-8', insightsOpen && 'bg-primary/10 text-primary')}
                title={insightsOpen ? t.hideInsights : t.showInsights}
                aria-label={insightsOpen ? t.hideInsights : t.showInsights}
                aria-pressed={insightsOpen}
                onClick={() => setInsightsOpen(o => !o)}
              >
                <Lightbulb className="h-3.5 w-3.5" />
              </Button>
            )}
            <Popover open={previewPopoverOpen} onOpenChange={setPreviewPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={cn(GHOST_CONTROL, 'h-8 w-8')} title={t.previewUrl} aria-label={t.previewUrl}>
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,380px)] space-y-3 p-4" align="end">
                {previewUrlPopoverInner}
              </PopoverContent>
            </Popover>

            <div className="flex rounded-lg border border-border bg-white p-0.5 shadow-sm dark:bg-muted">
              {([
                ['click', MousePointer, t.clicks, t.clicksHint],
                ['scroll', TrendingDown, t.scroll, t.scrollHint],
              ] as const).map(([type, Icon, label, hint]) => (
                <button
                  key={type}
                  type="button"
                  title={hint}
                  onClick={() => setHeatType(type)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    heatType === type
                      ? 'bg-primary/10 text-primary dark:bg-background dark:text-foreground dark:shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <RangeSelect value={days} onChange={setDays} ranges={ranges} />

            <Select value={device} onValueChange={v => setDevice(v as DeviceType)}>
              <SelectTrigger
                className={cn(GHOST_CONTROL, 'h-8 w-auto gap-1.5 px-2.5 text-[13px]')}
                title={t.device}
              >
                <SelectValue placeholder={t.device} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{m.devices.all}</SelectItem>
                <SelectItem value="desktop" className="text-xs">{m.devices.desktop}</SelectItem>
                <SelectItem value="mobile" className="text-xs">{m.devices.mobile}</SelectItem>
                <SelectItem value="tablet" className="text-xs">{m.devices.tablet}</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-lg border border-border bg-white p-0.5 shadow-sm dark:bg-muted">
              {previewModeOptions.map(([mode, Icon, label, hint]) => (
                <button
                  key={mode}
                  type="button"
                  title={hint}
                  onClick={() => setPreviewUnderlay(mode)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    previewUnderlay === mode
                      ? 'bg-primary/10 text-primary dark:bg-background dark:text-foreground dark:shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {mode === 'screenshot' ? (
                    <>
                      <span className="sm:hidden">{t.shot}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </>
                  ) : (
                    <span>{label}</span>
                  )}
                </button>
              ))}
            </div>

            {!isDemoMode && !embed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={t.more}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {activePreviewUrl ? (
                    <DropdownMenuItem
                      className="text-xs"
                      onClick={() => window.open(activePreviewUrl, '_blank', 'noopener,noreferrer')}
                    >
                      {t.openPreview}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="text-xs"
                    disabled={capturing || (!activePreviewUrl && !isParamPath)}
                    onClick={isParamPath && !activePreviewUrl ? () => setPreviewPopoverOpen(true) : captureScreenshot}
                  >
                    <Camera className="mr-2 h-3.5 w-3.5" />
                    {capturing ? t.capturing : isParamPath && !activePreviewUrl ? t.setPreviewUrl : t.captureScreenshot}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    {t.refreshData}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {isParamPath && !pageScreenshot && !isDemoMode && (
        <div className="shrink-0 border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 dark:border-amber-500/20 dark:bg-amber-500/5">
          <p className="text-xs text-amber-800 dark:text-amber-400">
            {t.paramPathBanner(
              <span key="p" className="font-medium">{t.paramPath}</span>,
              <code key="u" className="rounded-lg bg-amber-100/80 px-0.5 font-mono dark:bg-amber-500/10">{urlPath}</code>,
              <button
                key="b"
                type="button"
                className="font-medium underline underline-offset-2 hover:no-underline"
                onClick={() => setPreviewPopoverOpen(true)}
              >
                {t.previewUrl}
              </button>,
              <span key="c" className="font-medium">{t.captureScreenshot}</span>,
            )}
          </p>
        </div>
      )}

      {isParamPath && !isDemoMode && pageScreenshot?.source_path ? (
        <div className="shrink-0 border-b border-border bg-muted/40 px-4 py-1.5">
          <p className="text-xs text-muted-foreground">
            {t.backgroundFrom(
              <code key="s" className="rounded bg-muted px-1 font-mono text-foreground">{pageScreenshot.source_path}</code>,
              <code key="u" className="font-mono">{urlPath}</code>,
            )}
          </p>
        </div>
      ) : null}

      <main className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-2 px-2 pb-2 pt-1.5 md:px-4 md:pb-3 md:pt-2 lg:flex-row">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          {!activePreviewUrl && !isDemoMode && !pageScreenshot?.image_url && points.length === 0 && !isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">{t.addPreviewTitle}</p>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                {t.addPreviewBody}
              </p>
            </div>
          ) : (
            <div className="relative min-h-0 flex-1">
              {isDemoMode ? (
                <DemoHeatmapStage pageUrl={heatmapPathLine} heatType={heatType} />
              ) : (
                <HeatmapViewer
                  key={`${websiteId}:${urlPath}`}
                  pageUrl={activePreviewUrl || heatmapPathLine}
                  points={points}
                  heatType={heatType}
                  underlay={previewUnderlay}
                  preferredViewportWidth={preferredViewportWidth}
                  pageScreenshot={pageScreenshot ?? null}
                  requestedDevice={device}
                  websiteId={websiteId}
                />
              )}
              {points.length === 0 && !isLoading && !isDemoMode && (
                <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
                  <div className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
                    <p className="text-xs font-medium text-white/70">
                      {heatType === 'click'
                        ? t.noClicks
                        : t.noScroll}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/50">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <span className="text-xs font-medium text-foreground">{t.loading}</span>
              </div>
            </div>
          )}
        </div>

        {insightsAvailable && insightsOpen && (
          <HeatmapInsightsPanel
            websiteId={websiteId}
            pagePath={urlPath}
            days={days}
            device={device}
            onClose={() => setInsightsOpen(false)}
            className="max-h-[45vh] shrink-0 lg:max-h-none lg:w-[340px]"
          />
        )}
      </main>
    </div>
  );
}
