'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MousePointerClick,
  MousePointer2,
  RefreshCcw,
  Monitor,
  Smartphone,
  Tablet,
  Loader2,
  Eye,
  EyeOff,
  ArrowDownUp,
  Flame,
  MousePointerBan,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import HeatmapOverlay from '@/components/heatmap-overlay';
import api from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type HeatmapType = 'click' | 'move' | 'scroll' | 'rage_click' | 'dead_click';

const DATE_PRESETS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
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
  const [resolvedPoints, setResolvedPoints] = useState<any[]>([]);
  const latestPointsRef = useRef<any[]>([]);
  const latestDimensionsRef = useRef({ width: 1200, height: 800 });
  const deviceWidthRef = useRef(1200);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [opacity, setOpacity] = useState([70]);
  const [showOverlay, setShowOverlay] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onLoadPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [datePreset, setDatePreset] = useState(90);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [refreshKey, setRefreshKey] = useState(0);

  const isDemo = websiteId === 'demo';
  const isFreePlan = subscription?.plan === 'free';
  const showDummy = isDemo || isFreePlan;

  useEffect(() => { latestPointsRef.current = points; }, [points]);
  useEffect(() => { latestDimensionsRef.current = dimensions; }, [dimensions]);

  // Cleanup onLoad poller on unmount
  useEffect(() => {
    return () => {
      if (onLoadPollerRef.current) clearInterval(onLoadPollerRef.current);
    };
  }, []);

  // Listen for messages from the tracker script in the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SEENTICS_DIMENSIONS') {
        const { height } = event.data;
        if (height && height > 0) {
          setDimensions({ width: deviceWidthRef.current, height });
        }
      }
      if (event.data?.type === 'SEENTICS_ELEMENT_RECTS') {
        const rects: Record<string, { left: number; top: number; width: number; height: number }> = event.data.rects || {};
        const pts = latestPointsRef.current;
        const dims = latestDimensionsRef.current;
        const dw = deviceWidthRef.current || dims.width || 1;
        const dh = dims.height || 1;
        setResolvedPoints(pts.map((p: any) => {
          if (!p.selector || p.el_x == null || p.el_x < 0) return p;
          const rect = rects[p.selector];
          if (!rect || rect.width <= 0 || rect.height <= 0) return p;
          const px = rect.left + (p.el_x / 1000) * rect.width;
          const py = rect.top + (p.el_y / 1000) * rect.height;
          return { ...p, x: (px / dw) * 1000, y: (py / dh) * 1000, doc_height: dh };
        }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Request dimensions from the iframe periodically
  useEffect(() => {
    if (isDemo) {
      setDimensions({ width: 1200, height: 4000 });
      return;
    }
    const interval = setInterval(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loading, isDemo]);

  // Resolve element-relative click coordinates
  useEffect(() => {
    if (activeType === 'scroll') { setResolvedPoints(points); return; }
    const hasElCoords = points.some((p: any) => p.selector && p.el_x != null && p.el_x >= 0);
    if (!hasElCoords || !iframeRef.current?.contentWindow) { setResolvedPoints(points); return; }
    const selectors = Array.from(
      new Set(points.filter((p: any) => p.selector && p.el_x >= 0).map((p: any) => p.selector as string))
    );
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

  const buildDateParams = (from: string, to: string) => {
    return `&from=${encodeURIComponent(from + 'T00:00:00.000Z')}&to=${encodeURIComponent(to + 'T23:59:59.999Z')}`;
  };

  // Fetch heatmap points
  useEffect(() => {
    const abortController = new AbortController();
    const fetchPoints = async () => {
      setLoading(true);
      setPoints([]);
      if (showDummy) {
        if (!abortController.signal.aborted) { setPoints(generateDummyPoints(activeType)); setLoading(false); }
        return;
      }
      try {
        const dateParams = buildDateParams(dateFrom, dateTo);
        const response = await api.get(`/heatmaps/data?website_id=${websiteId}&url=${encodeURIComponent(url)}&type=${activeType}&device=${device}${dateParams}`, { signal: abortController.signal });
        if (abortController.signal.aborted) return;
        const rawPoints = response.data.points || [];
        setPoints(rawPoints.map((p: any) => ({ ...p, x: p.x_percent ?? p.x, y: p.y_percent ?? p.y, doc_height: p.doc_height ?? 0 })));
      } catch (err: any) {
        if (!abortController.signal.aborted) console.error('Failed to fetch heatmap points:', err);
      } finally {
        if (!abortController.signal.aborted) setLoading(false);
      }
    };
    fetchPoints();
    return () => { abortController.abort(); };
  }, [websiteId, url, activeType, device, showDummy, dateFrom, dateTo, refreshKey]);

  // Update view size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    const t = setTimeout(updateSize, 500);
    return () => { window.removeEventListener('resize', updateSize); clearTimeout(t); };
  }, [device, loading]);

  const getDeviceWidth = () => {
    if (device === 'mobile') return 375;
    if (device === 'tablet') return 768;
    return 1200;
  };

  const deviceWidth = getDeviceWidth();
  const scale = viewSize.width > 0 ? Math.min(1, (viewSize.width - 32) / deviceWidth) : 1;

  useEffect(() => {
    deviceWidthRef.current = deviceWidth;
    setDimensions(d => d.width !== deviceWidth ? { ...d, width: deviceWidth } : d);
  }, [deviceWidth]);

  const normalizeUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return 'http://' + trimmed;
  };

  const buildIframeUrl = () => {
    if (isDemo) return 'https://seentics.com';
    if (!website?.url) return '';
    const baseUrl = normalizeUrl(website.url).replace(/\/$/, '');
    const fullPath = url.startsWith('/') ? url : `/${url}`;
    try {
      const targetUrl = new URL(baseUrl);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
      if (typeof window !== 'undefined' && window.location.protocol === 'https:' && targetUrl.protocol === 'http:') {
        targetUrl.protocol = 'https:';
      }
      const isLocal = (h: string) => h === 'localhost' || h === '127.0.0.1' || h.includes('localhost');
      if (targetUrl.origin === currentOrigin) return fullPath;
      if (isLocal(currentHostname)) return fullPath;
      return `${targetUrl.origin}${fullPath}`;
    } catch {
      return fullPath;
    }
  };

  const siteUrl = buildIframeUrl();

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden select-none">
      {/* Toolbar */}
      <header className="border-b border-white/[0.06] bg-zinc-900/80 backdrop-blur-xl flex items-center gap-2 px-3 py-2 z-50 flex-shrink-0 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 hover:bg-white/10 text-zinc-400 hover:text-white flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="h-5 w-px bg-white/10" />

        {/* Type selector */}
        <div className="flex items-center gap-0.5 bg-zinc-800/60 rounded-lg p-0.5 border border-white/[0.06]">
          <ToolbarBtn active={activeType === 'click'} onClick={() => setActiveType('click')} icon={MousePointerClick} label="Clicks" />
          <ToolbarBtn active={activeType === 'move'} onClick={() => setActiveType('move')} icon={MousePointer2} label="Move" />
          <ToolbarBtn active={activeType === 'scroll'} onClick={() => setActiveType('scroll')} icon={ArrowDownUp} label="Scroll" />
          <ToolbarBtn active={activeType === 'rage_click'} onClick={() => setActiveType('rage_click')} icon={Flame} label="Rage" />
          <ToolbarBtn active={activeType === 'dead_click'} onClick={() => setActiveType('dead_click')} icon={MousePointerBan} label="Dead" />
        </div>

        <div className="h-5 w-px bg-white/10" />

        {/* Device selector */}
        <div className="flex items-center gap-0.5 bg-zinc-800/60 rounded-lg p-0.5 border border-white/[0.06]">
          <button onClick={() => setDevice('all')} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-all", device === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300')}>All</button>
          <ToolbarBtn active={device === 'desktop'} onClick={() => setDevice('desktop')} icon={Monitor} />
          <ToolbarBtn active={device === 'tablet'} onClick={() => setDevice('tablet')} icon={Tablet} />
          <ToolbarBtn active={device === 'mobile'} onClick={() => setDevice('mobile')} icon={Smartphone} />
        </div>

        <div className="h-5 w-px bg-white/10" />

        {/* Date presets */}
        <div className="flex items-center gap-0.5 bg-zinc-800/60 rounded-lg p-0.5 border border-white/[0.06]">
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
              className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-all", datePreset === p.days ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300")}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Opacity slider */}
        <div className="flex items-center gap-2 w-28">
          <Slider value={opacity} onValueChange={setOpacity} max={100} step={5} className="flex-1" />
          <span className="text-[10px] text-zinc-500 font-mono w-7 text-right">{opacity[0]}%</span>
        </div>

        <div className="h-5 w-px bg-white/10" />

        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10" onClick={() => setShowOverlay(!showOverlay)}>
          {showOverlay ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </Button>

        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10"
          disabled={loading}
          onClick={() => setRefreshKey(k => k + 1)}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
        </Button>

        {/* Info */}
        <span className="text-[10px] text-zinc-500 tabular-nums">{points.length.toLocaleString()} pts</span>
      </header>

      {/* Premium banner */}
      {(isFreePlan || isDemo) && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-1.5 px-4 flex items-center justify-center gap-3">
          <span className="text-xs text-amber-400/90">Preview mode — showing simulated data</span>
          <Link href={isDemo ? '/pricing' : `/websites/${websiteId}/billing`} className="text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300">
            Upgrade
          </Link>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex items-start justify-center pt-4 pb-4 px-4" ref={containerRef}>
        <div
          className="relative transition-all duration-300 ease-out rounded-lg overflow-hidden"
          style={{
            width: `${deviceWidth}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.4)',
            marginLeft: scale < 1 ? `${-deviceWidth * (1 - scale) / 2}px` : undefined,
            marginRight: scale < 1 ? `${-deviceWidth * (1 - scale) / 2}px` : undefined,
          }}
        >
          {/* Browser chrome */}
          <div className="h-8 bg-zinc-800/90 border-b border-white/[0.06] flex items-center px-3 gap-2.5 select-none">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-zinc-600/60" />
            </div>
            <div className="flex-1 bg-zinc-900/80 h-5 rounded flex items-center px-2.5 border border-white/[0.04]">
              <span className="text-[10px] text-zinc-500 truncate font-mono">{url}</span>
            </div>
          </div>

          {/* Content area */}
          <div
            className="bg-white overflow-y-auto overflow-x-hidden hide-scrollbar"
            style={{ height: 'calc(100vh - 120px)' }}
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

              {(loading || isLoadingWebsite) ? (
                <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-white/40">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-900" />
                    <span className="text-xs font-medium text-zinc-900">Loading heatmap data...</span>
                  </div>
                </div>
              ) : !points || points.length === 0 ? (
                <div className="absolute inset-0 bg-white/30 z-20 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl flex flex-col items-center gap-2 border border-white/40">
                    <MousePointerClick className="h-6 w-6 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-900">No data yet</span>
                    <span className="text-xs text-zinc-500">Waiting for interactions on this page</span>
                  </div>
                </div>
              ) : null}

              {siteUrl && (
                <iframe
                  ref={iframeRef}
                  src={siteUrl}
                  onLoad={(e) => {
                    const validIframe = e.currentTarget;
                    const scanHeight = () => {
                      if (!validIframe.contentWindow) return;
                      try {
                        const doc = validIframe.contentWindow.document;
                        const bodyHeight = Math.max(
                          doc.body.scrollHeight, doc.body.offsetHeight,
                          doc.documentElement.clientHeight, doc.documentElement.scrollHeight, doc.documentElement.offsetHeight
                        );
                        if (bodyHeight > 0) {
                          setDimensions({ width: deviceWidth, height: bodyHeight });
                        }
                      } catch {
                        // Cross-origin — fall through to postMessage
                      }
                    };
                    scanHeight();
                    setTimeout(scanHeight, 1500);
                    setTimeout(scanHeight, 3000);
                    // Clear any previous poller before starting a new one
                    if (onLoadPollerRef.current) clearInterval(onLoadPollerRef.current);
                    let attempts = 0;
                    onLoadPollerRef.current = setInterval(() => {
                      if (validIframe.contentWindow) {
                        validIframe.contentWindow.postMessage('SEENTICS_GET_DIMENSIONS', '*');
                        if (++attempts > 10) {
                          if (onLoadPollerRef.current) clearInterval(onLoadPollerRef.current);
                          onLoadPollerRef.current = null;
                        }
                      } else {
                        if (onLoadPollerRef.current) clearInterval(onLoadPollerRef.current);
                        onLoadPollerRef.current = null;
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
      </div>
    </div>
  );
}

function ToolbarBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all",
        active ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
      )}
    >
      <Icon className="h-3 w-3" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

export default function HeatmapViewPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      </div>
    }>
      <HeatmapViewContent />
    </Suspense>
  );
}
