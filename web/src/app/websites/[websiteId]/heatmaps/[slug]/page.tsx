'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, MousePointer, Move, Eye, Percent, Flame,
  AlertTriangle, RefreshCw, Monitor,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoHeatmapPages, demoHeatmapPoints } from '@/lib/demo/heatmaps';
import { getHeatmapData, type HeatmapPoint as ApiHeatmapPoint } from '@/lib/heatmaps-api';
import { cn } from '@/lib/utils';

type HeatType = 'click' | 'move';

interface HeatPoint {
  x: number;
  y: number;
  nx?: number;   // normalised 0-1 of viewport width
  ny?: number;   // normalised 0-1 of total page height
  intensity: number;
}

// ─── Canvas heatmap renderer ──────────────────────────────────────────────────
function drawHeatmap(
  canvas: HTMLCanvasElement,
  points: HeatPoint[],
  containerW: number,
  containerH: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !points.length) return;

  canvas.width  = containerW;
  canvas.height = containerH;
  ctx.clearRect(0, 0, containerW, containerH);

  for (const p of points) {
    // Use normalised coords if available, otherwise scale raw x/y
    const cx = p.nx != null ? p.nx * containerW : (p.x / 1440) * containerW;
    const cy = p.ny != null ? p.ny * containerH : (p.y / 900)  * containerH;
    const r  = Math.max(18, Math.min(50, p.intensity * 2.5));
    const alpha = Math.min(p.intensity / 20, 0.65);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,   `rgba(255, 50,  0, ${alpha})`);
    grad.addColorStop(0.4, `rgba(255,140,  0, ${alpha * 0.55})`);
    grad.addColorStop(0.8, `rgba(255,220,  0, ${alpha * 0.2})`);
    grad.addColorStop(1,   'rgba(255,220,0,0)');

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

// ─── Iframe + overlay viewer ──────────────────────────────────────────────────
function HeatmapIframeViewer({
  url,
  points,
  heatType,
}: {
  url: string;
  points: HeatPoint[];
  heatType: HeatType;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'blocked'>('loading');
  const [dims, setDims] = useState({ w: 1280, h: 720 });

  // Observe container resize
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Redraw heatmap whenever points or dimensions change
  useEffect(() => {
    if (!canvasRef.current || loadState === 'loading') return;
    drawHeatmap(canvasRef.current, points, dims.w, dims.h);
  }, [points, dims, loadState]);

  const handleIframeLoad = useCallback(() => {
    setLoadState('loaded');
  }, []);

  // Detect X-Frame-Options block: if iframe errors or stays blank
  const handleIframeError = useCallback(() => {
    setLoadState('blocked');
  }, []);

  // Timeout fallback for X-Frame-Options (browser won't fire error event)
  useEffect(() => {
    if (loadState !== 'loading') return;
    const t = setTimeout(() => {
      // If still loading after 8s, try to detect block
      try {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || iframeDoc.location.href === 'about:blank') {
          setLoadState('blocked');
        }
      } catch {
        // cross-origin access denied = iframe loaded an external site, which is fine
        setLoadState('loaded');
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [loadState]);

  return (
    <div ref={wrapperRef} className="relative w-full h-full overflow-hidden rounded-lg bg-muted/10 border border-border/40">
      {/* Iframe — pointer-events off so user can't interact */}
      {loadState !== 'blocked' && (
        <iframe
          ref={iframeRef}
          src={url}
          className="absolute inset-0 w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-forms"
          style={{ pointerEvents: 'none' }}
          title="Heatmap page preview"
        />
      )}

      {/* Blocked fallback: wireframe */}
      {loadState === 'blocked' && (
        <div className="absolute inset-0 p-6 flex flex-col gap-3 pointer-events-none">
          <div className="h-10 bg-border/25 rounded-md w-full" />
          <div className="h-44 bg-border/15 rounded-md w-full" />
          <div className="flex gap-3">
            <div className="h-28 bg-border/10 rounded-md flex-1" />
            <div className="h-28 bg-border/10 rounded-md flex-1" />
            <div className="h-28 bg-border/10 rounded-md flex-1" />
          </div>
          <div className="h-20 bg-border/10 rounded-md w-full" />
          <div className="flex gap-3">
            <div className="h-16 bg-border/10 rounded-md flex-1" />
            <div className="h-16 bg-border/10 rounded-md flex-1" />
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Loading page…</p>
          </div>
        </div>
      )}

      {/* Heatmap canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: 'multiply' }}
        width={dims.w}
        height={dims.h}
      />

      {/* Blocked badge */}
      {loadState === 'blocked' && (
        <div className="absolute top-3 right-3 z-30">
          <Badge variant="outline" className="text-[10px] bg-background/80 backdrop-blur-sm gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Iframe blocked by site — showing wireframe
          </Badge>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HeatmapDetailPage() {
  const params     = useParams();
  const router     = useRouter();
  const websiteId  = params?.websiteId as string;
  const slug       = params?.slug as string;
  const isDemoMode = isDemo(websiteId);

  const [heatType,  setHeatType]  = useState<HeatType>('click');
  const [customUrl, setCustomUrl] = useState('');
  const [liveUrl,   setLiveUrl]   = useState('');

  const urlPath = slug ? decodeURIComponent(slug).replace(/_/g, '/') : '/';

  // Demo page data
  const demoPages = isDemoMode ? demoHeatmapPages() : [];
  const demoPage  = demoPages.find(p => p.url === urlPath) ||
                    demoPages.find(p => p.url.replace(/\//g, '_') === slug) ||
                    demoPages[0];

  // Real API
  const { data: heatmapData, isLoading } = useQuery({
    queryKey:  ['heatmap-data', websiteId, urlPath, heatType],
    queryFn:   () => getHeatmapData(websiteId, urlPath, heatType === 'move' ? 'scroll' : 'click'),
    enabled:   !isDemoMode,
    staleTime: 60_000,
  });

  // Normalise points to HeatPoint[]
  const points: HeatPoint[] = isDemoMode
    ? demoHeatmapPoints(heatType)
    : (heatmapData?.points ?? []).map((p: ApiHeatmapPoint) => ({
        x:         p.x_percent * 10,  // rough pixel hint
        y:         p.y_percent * 10,
        nx:        p.x_percent / 100,
        ny:        p.y_percent / 100,
        intensity: p.intensity,
      }));

  const pageStats = isDemoMode && demoPage
    ? { views: demoPage.views, clicks: demoPage.clicks, avg_scroll: demoPage.avg_scroll }
    : { views: 0, clicks: points.length, avg_scroll: 0 };

  // Default iframe URL
  const defaultIframeUrl =
    typeof window !== 'undefined'
      ? (isDemoMode ? window.location.origin + (demoPage?.url ?? '/') : '')
      : '';

  useEffect(() => {
    if (liveUrl === '' && defaultIframeUrl) setLiveUrl(defaultIframeUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultIframeUrl]);

  const applyUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    setLiveUrl(trimmed.startsWith('http') ? trimmed : 'https://' + trimmed);
  };

  if (!isDemoMode && isLoading && !heatmapData) {
    // Show skeleton / loading while fetching for first time
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 h-[52px] border-b border-border/60 bg-card">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/heatmaps`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Heatmaps
        </Button>
        <div className="w-px h-4 bg-border/60" />
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-sm font-semibold text-foreground font-mono truncate">
          {isDemoMode ? (demoPage?.url ?? urlPath) : urlPath}
        </span>
        <div className="flex-1" />

        {/* Heat type toggle */}
        <div className="flex items-center gap-1">
          {(['click', 'move'] as HeatType[]).map(t => (
            <Button
              key={t}
              variant={heatType === t ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setHeatType(t)}
            >
              {t === 'click'
                ? <MousePointer className="h-3.5 w-3.5" />
                : <Move className="h-3.5 w-3.5" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>

        {isDemoMode && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
      </div>

      {/* ── Stats bar ── */}
      <div className="shrink-0 border-b border-border/40 px-4 md:px-6 py-2 bg-background">
        <div className="flex items-center gap-6 text-xs">
          {[
            { icon: Eye,          label: 'Views',      value: pageStats.views > 0 ? pageStats.views.toLocaleString() : '—' },
            { icon: MousePointer, label: 'Clicks',     value: pageStats.clicks.toLocaleString() },
            { icon: Move,         label: 'Avg Scroll', value: pageStats.avg_scroll > 0 ? `${pageStats.avg_scroll}%` : '—' },
            { icon: Percent,      label: 'Data Points',value: points.length.toString() },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span>{label}:</span>
              <span className="font-semibold text-foreground">{value}</span>
            </div>
          ))}
          {isLoading && !isDemoMode && (
            <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin ml-2" />
          )}
        </div>
      </div>

      {/* ── URL bar ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 md:px-6 py-2 border-b border-border/40 bg-muted/20">
        <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyUrl()}
          placeholder={defaultIframeUrl || 'https://your-site.com/page'}
          className="h-7 text-xs font-mono flex-1 bg-background/60"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs shrink-0"
          onClick={applyUrl}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Load
        </Button>
      </div>

      {/* ── Heatmap viewer (fills remaining height) ── */}
      <div className="flex-1 overflow-hidden p-4 md:p-6 min-h-0">
        <HeatmapIframeViewer
          url={liveUrl || defaultIframeUrl}
          points={points}
          heatType={heatType}
        />
      </div>

      {/* ── Legend ── */}
      <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-2 border-t border-border/40 bg-muted/10">
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-10 rounded-sm bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 opacity-80" />
            <span>Low → High activity</span>
          </div>
          <span>{points.length} data points</span>
        </div>
        {isDemoMode && (
          <p className="text-[11px] text-muted-foreground">
            Demo data — install tracker to see real clicks
          </p>
        )}
      </div>
    </div>
  );
}
