'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MousePointerClick,
  MousePointer2,
  RefreshCcw,
  Monitor,
  Smartphone,
  Tablet,
  Download,
  Share2,
  Info,
  Loader2,
  Ruler,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Crosshair,
  Eye,
  EyeOff,
  Edit,
  ArrowDownUp,
  Flame,
  MousePointerBan,
  Columns2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HeatmapOverlay from '@/components/heatmap-overlay';
import api from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type HeatmapType = 'click' | 'move' | 'scroll' | 'rage_click' | 'dead_click';

const TYPE_LABELS: Record<HeatmapType, string> = {
  click: 'Click map',
  move: 'Movement map',
  scroll: 'Scroll depth',
  rage_click: 'Rage clicks',
  dead_click: 'Dead clicks',
};

const DATE_PRESETS: { label: string; days: number }[] = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function HeatmapViewContent() {
  const { websiteId } = useParams();
  const { subscription } = useSubscription();
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get('url') || (websiteId === 'demo' ? 'https://seentics.com' : '/');

  const { data: website, isLoading: isLoadingWebsite } = useQuery({
    queryKey: ['website', websiteId],
    queryFn: async () => {
      const response = await api.get(`/user/websites/${websiteId}`);
      return response.data?.data ?? response.data;
    },
    enabled: !!websiteId && websiteId !== 'demo',
  });

  const [activeType, setActiveType] = useState<HeatmapType>('click');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile' | 'all'>('all');
  const [points, setPoints] = useState<any[]>([]);
  // resolvedPoints: same as points but with x/y replaced by element-relative
  // coordinates for click events that have a selector + el_x/el_y recorded.
  const [resolvedPoints, setResolvedPoints] = useState<any[]>([]);
  // Snapshot refs so postMessage callbacks can access latest values without
  // re-registering the message listener on every render.
  const latestPointsRef = useRef<any[]>([]);
  const latestDimensionsRef = useRef({ width: 1200, height: 800 });
  // Keep deviceWidth current inside the stable message-event closure.
  const deviceWidthRef = useRef(1200);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [showHeightControl, setShowHeightControl] = useState(false);
  const [opacity, setOpacity] = useState([70]);
  const [isSameOrigin, setIsSameOrigin] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Date range state
  const [datePreset, setDatePreset] = useState(90);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Top elements
  const [topElements, setTopElements] = useState<{ selector: string; clicks: number }[]>([]);

  // Comparison mode
  const [compareMode, setCompareMode] = useState(false);
  const [comparePoints, setComparePoints] = useState<any[]>([]);
  const [compareFrom, setCompareFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 60); return d.toISOString().split('T')[0];
  });
  const [compareTo, setCompareTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });

  const normalizeUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return 'http://' + trimmed;
  };

  useEffect(() => {
    if (!website?.url) return;
    try {
      const currentHostname = window.location.hostname;
      const targetUrl = new URL(normalizeUrl(website.url));
      setIsSameOrigin(currentHostname === targetUrl.hostname);
    } catch {
      setIsSameOrigin(false);
    }
  }, [website?.url]);

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'free';
  const showDummy = isDemo || isFreePlan;

  // Keep snapshot refs in-sync
  useEffect(() => { latestPointsRef.current = points; }, [points]);
  useEffect(() => { latestDimensionsRef.current = dimensions; }, [dimensions]);

  // Listen for messages from the tracker script in the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.data.type?.startsWith('SEENTICS_')) {
        // Handle seentics internal messages
      }
      if (event.data?.type === 'SEENTICS_DIMENSIONS') {
        const { height } = event.data;
        if (height && height > 0) {
          // FORCE ALIGN: Use exactly the deviceWidth for horizontal mapping
          // This ensures that the 100% basis matches the dashboard simulation perfectly.
          setDimensions({ width: deviceWidthRef.current, height });
          setShowHeightControl(false);
        }
      }
      // Element-rect response from the tracker: remap click points to element coords
      if (event.data?.type === 'SEENTICS_ELEMENT_RECTS') {
        const rects: Record<string, { left: number; top: number; width: number; height: number }> = event.data.rects || {};
        const pts = latestPointsRef.current;
        const dims = latestDimensionsRef.current;
        // Always use the live deviceWidth (not stale dimensions.width) so element
        // positions from the iframe (which renders at deviceWidth) map correctly.
        const dw = deviceWidthRef.current || dims.width || 1;
        const dh = dims.height || 1;
        setResolvedPoints(pts.map((p: any) => {
          if (!p.selector || p.el_x == null || p.el_x < 0) return p;
          const rect = rects[p.selector];
          if (!rect || rect.width <= 0 || rect.height <= 0) return p;
          // Compute pixel position within the page document
          const px = rect.left + (p.el_x / 1000) * rect.width;
          const py = rect.top + (p.el_y / 1000) * rect.height;
          // Normalise back to 0-1000 for HeatmapOverlay
          return { ...p, x: (px / dw) * 1000, y: (py / dh) * 1000 };
        }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Periodically request dimensions from the iframe
  useEffect(() => {
    if (isDemo) {
      setDimensions({ width: 1200, height: 4000 });
      return;
    }
    let attempts = 0;
    const requestDimensions = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
        attempts++;
        if (attempts > 5 && dimensions.height <= 2000) {
          setShowHeightControl(true);
        }
      }
    };
    const interval = setInterval(requestDimensions, 3000);
    return () => clearInterval(interval);
  }, [loading, isDemo, dimensions.height]);

  // When points arrive (or dimensions settle), try to resolve element-based
  // click coordinates via postMessage to the iframe tracker.
  // Falls back to raw page-relative coords after 1 s if the iframe doesn't respond.
  useEffect(() => {
    // Scroll heatmap uses band coords — no element resolution needed.
    if (activeType === 'scroll') {
      setResolvedPoints(points);
      return;
    }
    // Check whether any points carry element-relative coords.
    const hasElCoords = points.some((p: any) => p.selector && p.el_x != null && p.el_x >= 0);
    if (!hasElCoords || !iframeRef.current?.contentWindow) {
      setResolvedPoints(points);
      return;
    }
    const selectors = Array.from(
      new Set(points.filter((p: any) => p.selector && p.el_x >= 0).map((p: any) => p.selector as string))
    );
    // Fallback: if no response within 1 s, use original coords.
    const fallback = setTimeout(() => setResolvedPoints(latestPointsRef.current), 1000);
    iframeRef.current.contentWindow.postMessage({ type: 'SEENTICS_QUERY_ELEMENT_RECTS', selectors }, '*');
    return () => clearTimeout(fallback);
  }, [points, dimensions, activeType]);

  const generateDummyPoints = (type: HeatmapType) => {
    const count = type === 'click' ? 100 : type === 'move' ? 300 : 40;
    const dummyPoints = [];
    for (let i = 0; i < count; i++) {
      const centerX = Math.random() * 900 + 50;
      const centerY = Math.random() * 2000 + 100;
      const clusterSize = Math.floor(Math.random() * 12) + 2;
      for (let j = 0; j < clusterSize; j++) {
        dummyPoints.push({
          x: centerX + (Math.random() - 0.5) * 60,
          y: centerY + (Math.random() - 0.5) * 60,
          intensity: Math.floor(Math.random() * 25) + 5
        });
      }
    }
    return dummyPoints;
  };

  // Build date range params — always treat as UTC so users in non-UTC timezones
  // don't shift the boundary and accidentally exclude today's data.
  const buildDateParams = (from: string, to: string) => {
    const fromISO = from + 'T00:00:00.000Z';  // UTC start of day
    const toISO = to + 'T23:59:59.999Z';      // UTC end of day
    return `&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`;
  };

  // Fetch heatmap points
  useEffect(() => {
    let cancelled = false;
    const fetchPoints = async () => {
      setLoading(true);
      setPoints([]);
      setFetchError(null);
      if (showDummy) {
        if (!cancelled) { setPoints(generateDummyPoints(activeType)); setLoading(false); }
        return;
      }
      try {
        const dateParams = buildDateParams(dateFrom, dateTo);
        const response = await api.get(`/heatmaps/data?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}&device=${device}${dateParams}`);
        if (cancelled) return;
        const rawPoints = response.data.points || [];
        setPoints(rawPoints.map((p: any) => ({ ...p, x: p.x_percent ?? p.x, y: p.y_percent ?? p.y })));
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to fetch heatmap points:', err);
          setFetchError(err?.response?.data?.error || err?.message || 'Failed to load heatmap data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPoints();
    return () => { cancelled = true; };
  }, [websiteId, url, activeType, device, showDummy, dateFrom, dateTo, refreshKey]);

  // Fetch top elements for click-based types
  useEffect(() => {
    if (showDummy || !['click', 'rage_click', 'dead_click'].includes(activeType)) {
      setTopElements([]);
      return;
    }
    let cancelled = false;
    const fetchTopElements = async () => {
      try {
        const dateParams = buildDateParams(dateFrom, dateTo);
        const res = await api.get(`/heatmaps/top-elements?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}${dateParams}`);
        if (!cancelled) setTopElements(res.data.elements || []);
      } catch {
        if (!cancelled) setTopElements([]);
      }
    };
    fetchTopElements();
    return () => { cancelled = true; };
  }, [websiteId, url, activeType, showDummy, dateFrom, dateTo, refreshKey]);

  // Fetch comparison data
  useEffect(() => {
    if (!compareMode || showDummy) {
      setComparePoints([]);
      return;
    }
    let cancelled = false;
    const fetchCompare = async () => {
      try {
        const dateParams = buildDateParams(compareFrom, compareTo);
        const res = await api.get(`/heatmaps/data?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}&device=${device}${dateParams}`);
        if (!cancelled) {
          const raw = res.data.points || [];
          setComparePoints(raw.map((p: any) => ({ ...p, x: p.x_percent ?? p.x, y: p.y_percent ?? p.y })));
        }
      } catch {
        if (!cancelled) setComparePoints([]);
      }
    };
    fetchCompare();
    return () => { cancelled = true; };
  }, [compareMode, websiteId, url, activeType, device, compareFrom, compareTo, showDummy]);

  // Update view size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    const timer = setTimeout(updateSize, 500);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, [device, loading, showPanel]);

  const getDeviceWidth = () => {
    if (device === 'mobile') return 375;
    if (device === 'tablet') return 768;
    return 1200; // desktop or all → full width
  };

  const getDeviceScale = () => {
    if (viewSize.width === 0) return 1;
    const targetWidth = getDeviceWidth();
    const available = viewSize.width - 48;
    if (available >= targetWidth) return 1;
    return available / targetWidth;
  };

  const deviceWidth = getDeviceWidth();
  const scale = getDeviceScale();
  // Keep the ref current so the stable message-event handler uses the latest device width.
  // Also sync dimensions.width so it never lags behind when the device tab changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    deviceWidthRef.current = deviceWidth;
    setDimensions(d => d.width !== deviceWidth ? { ...d, width: deviceWidth } : d);
  }, [deviceWidth]);

  const buildIframeUrl = () => {
    if (isDemo) return 'https://seentics.com';
    if (!website?.url) return '';

    const baseUrl = normalizeUrl(website.url).replace(/\/$/, '');
    const fullPath = url.startsWith('/') ? url : `/${url}`;

    try {
      const targetUrl = new URL(baseUrl);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

      // Upgrade http → https to avoid mixed-content blocks when the app is on HTTPS
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && targetUrl.protocol === 'http:') {
        targetUrl.protocol = 'https:';
      }

      const isLocal = (h: string) => h === 'localhost' || h === '127.0.0.1' || h.includes('localhost');

      // If the origins match exactly (same protocol, host, and port), use relative path
      if (targetUrl.origin === currentOrigin) {
        return fullPath;
      }

      // If we are on localhost, and the target is also localhost but different port (or protocol)
      // We often want to use the current origin's context if it's the dashboard itself
      if (isLocal(currentHostname) && isLocal(targetUrl.hostname)) {
        console.log('[HeatmapView] Localhost origin detected, using current origin for iframe fallback');
        return fullPath;
      }

      const finalUrl = `${targetUrl.origin}${fullPath}`;
      console.log('[HeatmapView] External origin detected, loading full URL:', finalUrl);
      return finalUrl;
    } catch (err) {
      console.warn('[HeatmapView] Failed to parse website URL, defaulting to current origin path:', fullPath);
      return fullPath;
    }
  };

  const siteUrl = buildIframeUrl();

  const densityLabel = points.length > 500 ? 'High' : points.length > 100 ? 'Medium' : points.length > 0 ? 'Low' : 'None';

  // Derived scroll stats (only meaningful when activeType === 'scroll')
  const scrollStats = (() => {
    if (activeType !== 'scroll' || points.length === 0) return null;
    const bandMap: Record<number, number> = {};
    points.forEach((p: any) => {
      const band = Math.round(p.y);
      bandMap[band] = (bandMap[band] || 0) + (p.intensity || 1);
    });
    const topIntensity = bandMap[0] || Math.max(...Object.values(bandMap));
    if (topIntensity === 0) return null;

    // Max band reached (highest y where intensity > 0)
    const maxBandReached = Math.max(...Object.keys(bandMap).map(Number));

    // Average fold: first band where visits drop below 80%
    let avgFoldPct = 100;
    for (let b = 0; b <= 1000; b += 50) {
      if (!bandMap[b]) continue;
      const pct = (bandMap[b] / topIntensity) * 100;
      if (pct < 80 && b > 0) { avgFoldPct = Math.round((b / 1000) * 100); break; }
    }

    // Half-way visitors: % who reached 50% of page
    const halfBand = 500;
    const halfVisitors = bandMap[halfBand] ? Math.round((bandMap[halfBand] / topIntensity) * 100) : 0;

    // Total unique visitors (intensity at band 0 = all visitors)
    const totalVisitors = topIntensity;

    return { maxBandReached: Math.round((maxBandReached / 1000) * 100), avgFoldPct, halfVisitors, totalVisitors };
  })();

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden select-none">
      {/* Header */}
      <header className="h-12 border-b border-white/[0.06] bg-zinc-900/80 backdrop-blur-xl flex items-center justify-between px-4 z-50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 hover:bg-white/10 text-zinc-400 hover:text-white flex-shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-white truncate">Heatmap Analysis</span>
            <Badge variant="outline" className="text-[9px] py-0 h-4 border-emerald-500/40 text-emerald-400 font-medium flex-shrink-0">
              {showDummy ? 'Preview' : 'Live'}
            </Badge>
          </div>
          <span className="text-xs text-zinc-500 truncate max-w-[160px] md:max-w-sm hidden sm:block">{url}</span>
        </div>

        {/* Center: Device & Type (hidden on small screens, shown in panel) */}
        <div className="hidden lg:flex items-center gap-1 bg-zinc-800/60 rounded-lg p-0.5 border border-white/[0.06]">
          <TypeButton active={activeType === 'click'} onClick={() => setActiveType('click')} icon={MousePointerClick} label="Clicks" />
          <TypeButton active={activeType === 'move'} onClick={() => setActiveType('move')} icon={MousePointer2} label="Move" />
          <TypeButton active={activeType === 'scroll'} onClick={() => setActiveType('scroll')} icon={ArrowDownUp} label="Scroll" />
          <TypeButton active={activeType === 'rage_click'} onClick={() => setActiveType('rage_click')} icon={Flame} label="Rage" />
          <TypeButton active={activeType === 'dead_click'} onClick={() => setActiveType('dead_click')} icon={MousePointerBan} label="Dead" />
          <div className="w-px h-5 bg-white/10 mx-0.5" />
          <button onClick={() => setDevice('all')} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", device === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5')}>All</button>
          <DeviceButton active={device === 'desktop'} onClick={() => setDevice('desktop')} icon={Monitor} label="Desktop" />
          <DeviceButton active={device === 'tablet'} onClick={() => setDevice('tablet')} icon={Tablet} label="Tablet" />
          <DeviceButton active={device === 'mobile'} onClick={() => setDevice('mobile')} icon={Smartphone} label="Mobile" />
        </div>

        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setShowOverlay(!showOverlay)}>
                  {showOverlay ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showOverlay ? 'Hide overlay' : 'Show overlay'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="w-px h-5 bg-white/10 mx-0.5" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setShowPanel(!showPanel)}>
                  {showPanel ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showPanel ? 'Hide panel' : 'Show panel'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Premium banner */}
      {(isFreePlan || isDemo) && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-1.5 px-4 flex items-center justify-center gap-3">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span className="text-xs text-amber-400/90">Preview mode — showing simulated data</span>
          <Link href={isDemo ? '/pricing' : `/websites/${websiteId}/billing`} className="text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300">
            Upgrade
          </Link>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview area */}
        <div ref={containerRef} className={cn("flex-1 min-w-0 overflow-hidden flex items-start justify-center pt-6 pb-6 px-4 relative", compareMode && "gap-4")}>
          {/* Comparison period label */}
          {compareMode && (
            <div className="absolute top-2 left-4 z-30 flex gap-4">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Current: {dateFrom} — {dateTo}</Badge>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Compare: {compareFrom} — {compareTo}</Badge>
            </div>
          )}
          <div
            className="relative transition-all duration-300 ease-out rounded-xl overflow-hidden"
            style={{
              width: `${compareMode ? Math.min(deviceWidth, (viewSize.width - 100) / 2) : deviceWidth}px`,
              transform: `scale(${compareMode ? Math.min(1, (viewSize.width - 100) / 2 / deviceWidth) : scale})`,
              transformOrigin: 'top center',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 25px 80px rgba(0,0,0,0.5)',
              // Compensate for CSS transform not affecting layout flow
              marginLeft: scale < 1 && !compareMode ? `${-deviceWidth * (1 - scale) / 2}px` : undefined,
              marginRight: scale < 1 && !compareMode ? `${-deviceWidth * (1 - scale) / 2}px` : undefined,
            }}
          >
            {/* Browser chrome */}
            <div className="h-9 bg-zinc-800/90 border-b border-white/[0.06] flex items-center px-3.5 gap-3 select-none">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
              </div>
              <div className="flex-1 bg-zinc-900/80 h-5.5 rounded flex items-center px-3 border border-white/[0.04]">
                <span className="text-[10px] text-zinc-500 truncate font-mono">{siteUrl}</span>
              </div>
            </div>

            {/* Content */}
            <div
              ref={mainScrollRef}
              className="bg-white overflow-y-auto overflow-x-hidden hide-scrollbar"
              style={{ height: 'calc(100vh - 140px)' }}
            >
              <div style={{ height: `${dimensions.height}px`, width: `${deviceWidth}px`, position: 'relative' }}>
                {showOverlay && (
                  <HeatmapOverlay
                    points={resolvedPoints}
                    width={deviceWidth}
                    height={dimensions.height}
                    totalWidth={deviceWidth}
                    totalHeight={dimensions.height}
                    opacity={opacity[0] / 100}
                    type={activeType}
                  />
                )}

                {loading || isLoadingWebsite ? (
                  <div className="absolute inset-0 bg-white/30 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-2xl flex items-center gap-4 border border-white/40 ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
                      <div className="relative">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-900" />
                        <div className="absolute inset-0 blur-sm bg-zinc-400/20 rounded-full animate-pulse" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-900 tracking-tight">Syncing Data</span>
                        <span className="text-[10px] text-zinc-500 font-medium">Mapping interaction coordinates...</span>
                      </div>
                    </div>
                  </div>
                ) : iframeError ? (
                  <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                      <Info className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex flex-col items-center text-center px-4">
                      <span className="text-sm font-medium text-zinc-800">Unable to load page preview</span>
                      <p className="text-xs text-zinc-500 mt-2 max-w-sm">
                        This usually happens if the target website blocks embedding or if the <strong>Website URL</strong> in your settings doesn't match your current environment.
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Currently registered: <code className="bg-zinc-100 px-1 rounded">{website?.url}</code>
                      </p>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={() => setIframeError(false)} size="sm" variant="outline">
                          Retry
                        </Button>
                        <Button onClick={() => router.push(`/websites/${websiteId}/settings`)} size="sm" variant="secondary" className="gap-1.5">
                          <Edit className="h-3 w-3" />
                          Update Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : fetchError ? (
                  <div className="absolute inset-0 bg-white/40 z-20 flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl flex flex-col items-center gap-2 border border-white/20">
                      <Info className="h-8 w-8 text-red-400" />
                      <span className="text-sm font-medium text-zinc-900">Failed to load heatmap data</span>
                      <span className="text-xs text-zinc-500 text-center max-w-[220px]">{fetchError}</span>
                    </div>
                  </div>
                ) : !points || points.length === 0 ? (
                  <div className="absolute inset-0 bg-white/40 z-20 flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl flex flex-col items-center gap-2 border border-white/20">
                      <Crosshair className="h-8 w-8 text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-900">No data recorded yet</span>
                      <span className="text-xs text-zinc-500">Waiting for first interactions on this path</span>
                    </div>
                  </div>
                ) : null}

                {siteUrl && (
                  <iframe
                    ref={iframeRef}
                    src={siteUrl}
                    onError={() => {
                      console.error('Iframe failed to load:', siteUrl);
                      setIframeError(true);
                    }}
                    onLoad={(e) => {
                      setIframeError(false);
                      const validIframe = e.currentTarget;
                      const scanHeight = () => {
                        if (!validIframe.contentWindow) return;
                        try {
                          const doc = validIframe.contentWindow.document;
                          const bodyHeight = Math.max(
                            doc.body.scrollHeight, doc.body.offsetHeight,
                            doc.documentElement.clientHeight, doc.documentElement.scrollHeight, doc.documentElement.offsetHeight
                          );
                          let maxInnerHeight = bodyHeight;
                          const scrollables = doc.querySelectorAll('div, main, section');
                          for (let i = 0; i < scrollables.length; i++) {
                            const el = scrollables[i] as Element;
                            if (el.scrollHeight > maxInnerHeight) {
                              const style = (validIframe.contentWindow as Window).getComputedStyle(el);
                              if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && style.display !== 'none') {
                                maxInnerHeight = el.scrollHeight;
                              }
                            }
                          }
                          if (maxInnerHeight > 0) {
                            setDimensions({ width: deviceWidth, height: maxInnerHeight });
                            setShowHeightControl(false);
                          }
                        } catch {
                          // Cross-origin — fall through to postMessage polling
                        }
                      };
                      scanHeight();
                      setTimeout(scanHeight, 1500);
                      setTimeout(scanHeight, 3000);
                      let attempts = 0;
                      const poller = setInterval(() => {
                        if (validIframe.contentWindow) {
                          validIframe.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
                          attempts++;
                          if (attempts > 10) clearInterval(poller);
                        } else {
                          clearInterval(poller);
                        }
                      }, 500);
                    }}
                    referrerPolicy="same-origin"
                    className="absolute inset-0 w-full h-full border-none pointer-events-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Comparison view panel */}
          {compareMode && (
            <div
              className="relative transition-all duration-300 ease-out rounded-xl overflow-hidden"
              style={{
                width: `${Math.min(deviceWidth, (viewSize.width - 100) / 2)}px`,
                transform: `scale(${Math.min(1, (viewSize.width - 100) / 2 / deviceWidth)})`,
                transformOrigin: 'top center',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 25px 80px rgba(0,0,0,0.5)',
              }}
            >
              <div className="h-9 bg-zinc-800/90 border-b border-white/[0.06] flex items-center px-3.5 gap-3 select-none">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500/60" />
                </div>
                <div className="flex-1 bg-zinc-900/80 h-5.5 rounded flex items-center px-3 border border-white/[0.04]">
                  <span className="text-[10px] text-blue-400 truncate font-mono">Compare: {compareFrom} — {compareTo}</span>
                </div>
              </div>
              <div className="bg-white overflow-y-auto overflow-x-hidden hide-scrollbar" style={{ height: 'calc(100vh - 140px)' }}>
                <div style={{ height: `${dimensions.height}px`, width: `${deviceWidth}px`, position: 'relative' }}>
                  <HeatmapOverlay
                    points={comparePoints}
                    width={deviceWidth}
                    height={dimensions.height}
                    totalWidth={deviceWidth}
                    totalHeight={dimensions.height}
                    opacity={opacity[0] / 100}
                    type={activeType}
                  />
                  {comparePoints.length === 0 && (
                    <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center gap-2">
                      <Crosshair className="h-8 w-8 text-zinc-300" />
                      <span className="text-sm font-medium text-zinc-400">No data for comparison period</span>
                    </div>
                  )}
                  {siteUrl && (
                    <iframe
                      src={siteUrl}
                      referrerPolicy="same-origin"
                      className="absolute inset-0 w-full h-full border-none pointer-events-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Height calibration popup */}
          {showHeightControl && (
            <div className="fixed bottom-14 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl w-72 z-[60]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Ruler className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="text-xs font-medium">Height Calibration</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" onClick={() => {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
                  }
                }}>
                  <RefreshCcw className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[10px] text-zinc-500 mb-3">Auto-detection incomplete. Adjust manually if needed.</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>Height</span>
                  <span className="font-mono">{dimensions.height}px</span>
                </div>
                <Slider
                  value={[dimensions.height]}
                  onValueChange={(v) => setDimensions({ ...dimensions, height: v[0] })}
                  min={500}
                  max={10000}
                  step={100}
                />
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full h-7 text-xs border-white/10 text-zinc-300 hover:bg-white/5" onClick={() => setShowHeightControl(false)}>
                Done
              </Button>
            </div>
          )}
        </div>

        {/* Right sidebar panel */}
        {showPanel && (
          <aside className="w-[320px] border-l border-white/[0.06] bg-zinc-900/50 flex flex-col flex-shrink-0 overflow-y-auto hide-scrollbar">
            {/* Mobile-only controls (type & device shown here on small screens) */}
            <div className="lg:hidden p-4 space-y-4 border-b border-white/[0.06]">
              <PanelSection title="Overlay Type">
                <div className="flex flex-wrap gap-1.5">
                  <TypeButton active={activeType === 'click'} onClick={() => setActiveType('click')} icon={MousePointerClick} label="Clicks" />
                  <TypeButton active={activeType === 'move'} onClick={() => setActiveType('move')} icon={MousePointer2} label="Move" />
                  <TypeButton active={activeType === 'scroll'} onClick={() => setActiveType('scroll')} icon={ArrowDownUp} label="Scroll" />
                  <TypeButton active={activeType === 'rage_click'} onClick={() => setActiveType('rage_click')} icon={Flame} label="Rage" />
                  <TypeButton active={activeType === 'dead_click'} onClick={() => setActiveType('dead_click')} icon={MousePointerBan} label="Dead" />
                </div>
              </PanelSection>
              <PanelSection title="Device">
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setDevice('all')} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all", device === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5')}>All</button>
                  <DeviceButton active={device === 'desktop'} onClick={() => setDevice('desktop')} icon={Monitor} label="Desktop" />
                  <DeviceButton active={device === 'tablet'} onClick={() => setDevice('tablet')} icon={Tablet} label="Tablet" />
                  <DeviceButton active={device === 'mobile'} onClick={() => setDevice('mobile')} icon={Smartphone} label="Mobile" />
                </div>
              </PanelSection>
            </div>

            {/* Opacity */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Opacity">
                <div className="flex items-center gap-3">
                  <Slider
                    value={opacity}
                    onValueChange={setOpacity}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs text-zinc-400 font-mono w-8 text-right">{opacity[0]}%</span>
                </div>
              </PanelSection>
            </div>

            {/* Date Range Picker */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Date Range">
                <div className="space-y-2.5">
                  <div className="flex gap-1">
                    {DATE_PRESETS.map(p => (
                      <button
                        key={p.days}
                        onClick={() => {
                          setDatePreset(p.days);
                          const to = new Date();
                          const from = new Date();
                          from.setDate(from.getDate() - p.days);
                          setDateFrom(from.toISOString().split('T')[0]);
                          setDateTo(to.toISOString().split('T')[0]);
                        }}
                        className={cn(
                          "flex-1 px-1.5 py-1 rounded text-[10px] font-medium transition-all",
                          datePreset === p.days ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setDatePreset(0); }}
                      className="h-7 text-[10px] bg-zinc-800/60 border-white/10 text-zinc-300 [color-scheme:dark]"
                    />
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setDatePreset(0); }}
                      className="h-7 text-[10px] bg-zinc-800/60 border-white/10 text-zinc-300 [color-scheme:dark]"
                    />
                  </div>
                </div>
              </PanelSection>
            </div>

            {/* Comparison Mode */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Compare">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start h-8 text-xs gap-2",
                    compareMode ? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20" : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => setCompareMode(!compareMode)}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  {compareMode ? 'Comparing...' : 'Compare Periods'}
                </Button>
                {compareMode && (
                  <div className="space-y-2 mt-2">
                    <span className="text-[9px] text-blue-400 uppercase tracking-wider">Compare period</span>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={compareFrom}
                        onChange={(e) => setCompareFrom(e.target.value)}
                        className="h-7 text-[10px] bg-zinc-800/60 border-blue-500/20 text-zinc-300 [color-scheme:dark]"
                      />
                      <Input
                        type="date"
                        value={compareTo}
                        onChange={(e) => setCompareTo(e.target.value)}
                        className="h-7 text-[10px] bg-zinc-800/60 border-blue-500/20 text-zinc-300 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                )}
              </PanelSection>
            </div>

            {/* Color scale legend */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Color Scale">
                <div className="space-y-2">
                  <div className="h-2.5 w-full rounded-full overflow-hidden" style={{
                    background: activeType === 'rage_click'
                      ? 'linear-gradient(to right, rgba(251,191,36,0.8), rgba(249,115,22,0.8), rgba(239,68,68,0.9), rgba(220,38,38,0.9))'
                      : activeType === 'dead_click'
                        ? 'linear-gradient(to right, rgba(148,163,184,0.6), rgba(100,116,139,0.7), rgba(71,85,105,0.8), rgba(51,65,85,0.9))'
                        : 'linear-gradient(to right, rgba(59,130,246,0.8), rgba(34,211,238,0.8), rgba(163,230,53,0.8), rgba(250,204,21,0.8), rgba(239,68,68,0.9))'
                  }} />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <><span>Low</span><span>Medium</span><span>High</span></>
                  </div>
                </div>
              </PanelSection>
            </div>

            {/* Top Elements */}
            {['click', 'rage_click', 'dead_click'].includes(activeType) && topElements.length > 0 && (
              <div className="p-4 border-b border-white/[0.06]">
                <PanelSection title={`Top ${activeType === 'rage_click' ? 'Rage' : activeType === 'dead_click' ? 'Dead' : ''} Clicked Elements`}>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto hide-scrollbar">
                    {topElements.slice(0, 10).map((el, i) => {
                      const maxClicks = topElements[0]?.clicks || 1;
                      const shortSelector = el.selector.length > 35
                        ? '...' + el.selector.slice(-32)
                        : el.selector;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400 truncate max-w-[160px] font-mono" title={el.selector}>
                              {shortSelector}
                            </span>
                            <span className="text-[10px] text-zinc-300 font-medium tabular-nums">{el.clicks}</span>
                          </div>
                          <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                activeType === 'rage_click' ? 'bg-orange-500/70' : activeType === 'dead_click' ? 'bg-slate-500/70' : 'bg-violet-500/70'
                              )}
                              style={{ width: `${(el.clicks / maxClicks) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </PanelSection>
              </div>
            )}

            {/* Scroll Depth Stats (only for scroll type) */}
            {activeType === 'scroll' && scrollStats && (
              <div className="p-4 border-b border-white/[0.06]">
                <PanelSection title="Scroll Depth">
                  <div className="space-y-2.5">
                    <StatRow label="Total Visitors" value={scrollStats.totalVisitors.toLocaleString()} />
                    <StatRow label="Reached 50%" value={`${scrollStats.halfVisitors}%`} />
                    <StatRow label="Max Depth" value={`${scrollStats.maxBandReached}%`} />
                    <StatRow label="Avg Fold" value={`~${scrollStats.avgFoldPct}% of page`} />
                  </div>
                  {/* Mini depth bar */}
                  <div className="mt-3 space-y-1">
                    {[0, 25, 50, 75, 100].map(pct => {
                      const band = pct * 10;
                      const intensity = (points as any[]).reduce((s: number, p: any) => Math.round(p.y) === band ? s + (p.intensity || 1) : s, 0);
                      const ratio = scrollStats.totalVisitors > 0 ? intensity / scrollStats.totalVisitors : 0;
                      return (
                        <div key={pct} className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-500 w-7 text-right tabular-nums">{pct}%</span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                              style={{ width: `${Math.round(ratio * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-zinc-400 tabular-nums w-7">{Math.round(ratio * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </PanelSection>
              </div>
            )}

            {/* Statistics */}
            <div className="p-4 border-b border-white/[0.06]">
              <PanelSection title="Statistics">
                <div className="space-y-2.5">
                  <StatRow label="Data Points" value={points.length.toLocaleString()} />
                  <StatRow label="Overlay" value={TYPE_LABELS[activeType] || activeType} />
                  <StatRow label="Density" value={densityLabel} />
                  <StatRow label="Viewport" value={`${deviceWidth}px`} />
                  <StatRow label="Page Height" value={`${dimensions.height}px`} />
                  <StatRow label="Date Range" value={`${datePreset || 'Custom'}${datePreset ? 'd' : ''}`} />
                  {compareMode && <StatRow label="Compare Points" value={comparePoints.length.toLocaleString()} />}
                </div>
              </PanelSection>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
              <PanelSection title="Tools">
                <div className="space-y-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-zinc-400 hover:text-white hover:bg-white/5 gap-2"
                    onClick={() => setShowOverlay(!showOverlay)}
                  >
                    {showOverlay ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showOverlay ? 'Hide Overlay' : 'Show Overlay'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-zinc-400 hover:text-white hover:bg-white/5 gap-2"
                    onClick={() => setShowHeightControl(!showHeightControl)}
                  >
                    <Ruler className="h-3.5 w-3.5" />
                    Adjust Height
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 text-xs text-zinc-400 hover:text-white hover:bg-white/5 gap-2"
                    disabled={loading}
                    onClick={() => setRefreshKey(k => k + 1)}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                  </Button>
                </div>
              </PanelSection>
            </div>
          </aside>
        )}
      </div>

      {/* Status bar */}
      <footer className="h-7 border-t border-white/[0.06] bg-zinc-900/60 flex items-center px-4 gap-4 text-[10px] text-zinc-500 flex-shrink-0 z-50">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", showDummy ? "bg-amber-500" : "bg-emerald-500 animate-pulse")} />
          <span>{showDummy ? 'Preview Mode' : 'Live'}</span>
        </div>
        <div className="h-3 w-px bg-white/10" />
        <span>{points.length.toLocaleString()} data points</span>
        <div className="h-3 w-px bg-white/10" />
        <span className="capitalize">{device === 'all' ? 'All Devices' : device} &middot; {deviceWidth}×{dimensions.height}px</span>
        <div className="flex-1" />
        <span className="hidden sm:block">
          {TYPE_LABELS[activeType]} &middot; {opacity[0]}% opacity{compareMode ? ' · Comparing' : ''}
        </span>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium">{value}</span>
    </div>
  );
}

function TypeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
        active
          ? "bg-white/10 text-white"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function DeviceButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "flex items-center justify-center h-6 w-7 rounded-md transition-all",
              active
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function HeatmapViewPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Loading heatmap...</span>
        </div>
      </div>
    }>
      <HeatmapViewContent />
    </Suspense>
  );
}
