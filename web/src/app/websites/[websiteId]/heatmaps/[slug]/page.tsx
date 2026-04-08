'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, MousePointer, Flame,
  AlertTriangle, RefreshCw, Monitor,
  TrendingDown, Layers, Link2,
  MoreHorizontal, ChevronDown,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { isDemo } from '@/lib/demo';
import { demoHeatmapPages, demoHeatmapPoints } from '@/lib/demo/heatmaps';
import { getHeatmapData, heatmapPageSlug, type HeatmapPoint as ApiHeatmapPoint } from '@/lib/heatmaps-api';
import { normalizeWebsiteOriginForPreview } from '@/lib/website-preview-url';
import { getWebsiteByAnyId } from '@/lib/websites-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type HeatType   = 'click' | 'scroll';
type DeviceType = 'all' | 'desktop' | 'mobile' | 'tablet';

interface HeatPoint {
  /** 0–1: click `pageX` ÷ document scroll width (same idea as `ny` horizontally). */
  nx:        number;
  /** 0–1: click `pageY` ÷ document scroll height. */
  ny:        number;
  intensity: number;
  selector?: string;
  device?:   string;
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatPathSegment(seg: string): string {
  if (/^s[-_]?/i.test(seg) || /^session[-_]/i.test(seg)) {
    return seg.length > 14 ? `Session · ${seg.slice(-8)}` : 'Session';
  }
  if (seg.length > 40) return `${seg.slice(0, 16)}…`;
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
}

/** Title skips `websites`, site UUID, and noise; subtitle is the short logical path. */
function heatmapPageHeading(path: string, websiteId?: string): { title: string; subtitle: string } {
  const segs = path.split('/').filter(Boolean);
  const meaningful = segs.filter(s => {
    if (s === 'websites') return false;
    if (websiteId && s === websiteId) return false;
    if (UUID_SEGMENT.test(s)) return false;
    return true;
  });
  if (!meaningful.length) {
    return { title: 'Heatmap', subtitle: path.startsWith('/') ? path : `/${path}` };
  }
  const title = meaningful.map(formatPathSegment).join(' · ');
  const subtitle = `/${meaningful.join('/')}`;
  return { title, subtitle };
}

/**
 * Pixel height for the heat layer + iframe. Clicks use ny ∈ [0,1] over the *full* document; height must
 * represent that full range for dots to line up (not just max(ny)).
 */
function documentPixelHeightForHeatmap(
  points: HeatPoint[],
  heatType: HeatType,
  portWidth: number,
  iframeDocPx: number | null,
): number {
  const w = Math.max(320, portWidth);
  const minH = 520;
  if (iframeDocPx != null && iframeDocPx >= minH) {
    return Math.round(iframeDocPx);
  }
  if (!points.length) {
    return Math.max(minH, Math.round(w * 2));
  }
  const pad = heatType === 'scroll' ? 0.04 : 0.1;
  const maxNyRaw = Math.max(...points.map(p => p.ny), heatType === 'scroll' ? 0.05 : 0.08);
  // Clicks: assume at least full document (1.0) in normalized Y so coords match tracker pageY/docH.
  const bottom = heatType === 'click'
    ? Math.min(1.55, Math.max(1, maxNyRaw + pad))
    : Math.min(1.55, Math.max(0.1, maxNyRaw + pad));
  const scale = Math.max(2400, w * 2.6);
  return Math.max(minH, Math.ceil(bottom * scale));
}

// ─── Heatmap canvas renderer ──────────────────────────────────────────────────
// Two-pass: draw grayscale intensity map then apply colour ramp.
function drawClickHeatmap(canvas: HTMLCanvasElement, points: HeatPoint[], w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!points.length) return;

  // Offscreen canvas for intensity pass
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d')!;
  octx.globalCompositeOperation = 'lighter';

  const maxI = Math.max(...points.map(p => p.intensity), 1);
  // Tight spots: radius scales with canvas size only — not intensity (high counts were “bomb” sized).
  const ref  = Math.min(w, h);
  const rSpot = Math.max(4, Math.min(22, ref * 0.014));

  for (const p of points) {
    const cx = Math.min(w, Math.max(0, p.nx * w));
    const cy = Math.min(h, Math.max(0, p.ny * h));
    const norm = p.intensity / maxI;
    const alpha = 0.032 + Math.sqrt(norm) * 0.22;

    const g = octx.createRadialGradient(cx, cy, 0, cx, cy, rSpot);
    g.addColorStop(0,   `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.25})`);
    g.addColorStop(1,   'rgba(255,255,255,0)');
    octx.beginPath();
    octx.arc(cx, cy, rSpot, 0, Math.PI * 2);
    octx.fillStyle = g;
    octx.fill();
  }

  // Colour ramp: transparent → blue → cyan → green → yellow → orange → red
  const ramp: [number, [number, number, number, number]][] = [
    [0,   [  0,   0,   0,   0]],
    [20,  [  0,  50, 255,  40]],
    [70,  [  0, 180, 255, 130]],
    [120, [  0, 255, 180, 190]],
    [170, [100, 255,   0, 210]],
    [210, [255, 230,   0, 230]],
    [240, [255, 100,   0, 245]],
    [255, [255,   0,   0, 255]],
  ];

  const imgData = octx.getImageData(0, 0, w, h);
  const px = imgData.data;

  for (let i = 0; i < px.length; i += 4) {
    const v = px[i + 3];
    if (v === 0) continue;
    const c = rampAt(ramp, Math.min(v, 255));
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  }

  ctx.putImageData(imgData, 0, 0);
}

// Draw scroll-depth heatmap: horizontal translucent bands at each depth milestone.
function drawScrollHeatmap(canvas: HTMLCanvasElement, points: HeatPoint[], w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!points.length) return;

  const maxI = Math.max(...points.map(p => p.intensity), 1);

  // Sort by ny ascending (top to bottom)
  const sorted = [...points].sort((a, b) => a.ny - b.ny);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const yPx = p.ny * h;
    const norm = p.intensity / maxI;

    // Gradient fill from previous depth to this one
    const prevY = i === 0 ? 0 : sorted[i - 1].ny * h;
    const bandH = yPx - prevY;
    if (bandH > 0) {
      const alpha = 0.06 + norm * 0.2;
      // warm at top (high coverage), cool at bottom
      const heat = 1 - p.ny; // 1 at top, 0 at bottom
      const r = Math.round(heat * 200 + 50);
      const g = Math.round((1 - heat) * 200 + 50);
      const b = Math.round((1 - heat) * 255);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(0, prevY, w, bandH);
    }

    // Horizontal fold line
    const lineAlpha = 0.25 + norm * 0.55;
    const heat2 = 1 - p.ny;
    const lr = Math.round(heat2 * 230 + 20);
    const lg = Math.round((1 - heat2) * 230 + 20);
    const lb = Math.round((1 - heat2) * 255);
    ctx.beginPath();
    ctx.moveTo(0, yPx);
    ctx.lineTo(w, yPx);
    ctx.strokeStyle = `rgba(${lr},${lg},${lb},${lineAlpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Depth label
    const pctLabel = `${Math.round(p.ny * 100)}% — ${p.intensity.toLocaleString()} users`;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = `rgba(255,255,255,0.75)`;
    ctx.fillText(pctLabel, 8, yPx - 5);
  }
}

function rampAt(ramp: [number, [number, number, number, number]][], v: number): [number, number, number, number] {
  for (let i = 1; i < ramp.length; i++) {
    if (v <= ramp[i][0]) {
      const [v0, c0] = ramp[i - 1];
      const [v1, c1] = ramp[i];
      const t = (v - v0) / (v1 - v0);
      return c0.map((c, idx) => Math.round(c + (c1[idx] - c) * t)) as [number, number, number, number];
    }
  }
  return ramp[ramp.length - 1][1];
}

/** Neutral underlay when the live page cannot be embedded (faster + clearer than a page wireframe). */
function HeatOnlyUnderlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(to bottom, rgb(24 24 27 / 0.97), rgb(9 9 11 / 1)),
            radial-gradient(ellipse 80% 50% at 50% -20%, rgb(59 130 246 / 0.12), transparent 55%),
            linear-gradient(rgb(39 39 42 / 0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgb(39 39 42 / 0.35) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px',
          backgroundPosition: '0 0, 0 0, 0 0, 0 0',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-8 max-w-sm">
          <p className="text-[11px] font-medium text-zinc-400 tracking-wide uppercase">Heatmap overlay</p>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            Coordinates are shown on this grid. Open the real page in a new tab to compare layout.
          </p>
        </div>
      </div>
    </div>
  );
}

type PreviewUnderlay = 'iframe' | 'heat-only';

// ─── Canvas overlay ───────────────────────────────────────────────────────────
function HeatmapViewer({
  url,
  points,
  heatType,
  overlayOpacity = 1,
  underlay,
  onUnderlayBlocked,
}: {
  url: string;
  points: HeatPoint[];
  heatType: HeatType;
  /** 0–1 multiplier on the heat canvas only */
  overlayOpacity?: number;
  /** When `heat-only`, skip iframe (user choice or embedding unusable). */
  underlay: PreviewUnderlay;
  /** Called when iframe fails to load so parent can switch toggle default. */
  onUnderlayBlocked?: () => void;
}) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onBlockedRef = useRef(onUnderlayBlocked);
  onBlockedRef.current = onUnderlayBlocked;
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [viewPort, setViewPort] = useState<{ w: number; h: number }>({ w: 1280, h: 0 });
  const [measuredIframeDocH, setMeasuredIframeDocH] = useState<number | null>(null);

  const showIframe = underlay === 'iframe';

  const docPx = useMemo(() => {
    const fromClicks = documentPixelHeightForHeatmap(points, heatType, viewPort.w, null);
    let h: number;
    if (measuredIframeDocH != null && measuredIframeDocH >= 520) {
      h = Math.max(fromClicks, measuredIframeDocH);
    } else {
      h = fromClicks;
    }
    // While the iframe loads (or we have no heat rows yet), don’t collapse shorter than the visible panel.
    const iframeBoot =
      showIframe &&
      !!url &&
      loadState !== 'error' &&
      (loadState === 'loading' || (points.length === 0 && loadState !== 'loaded'));
    if (iframeBoot && viewPort.h >= 120) {
      h = Math.max(h, viewPort.h);
    }
    return h;
  }, [points, heatType, viewPort.w, viewPort.h, measuredIframeDocH, showIframe, url, loadState]);

  const dims = useMemo(() => ({ w: viewPort.w, h: docPx }), [viewPort.w, docPx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setViewPort({
        w: Math.max(1, Math.round(width)),
        h: Math.max(0, Math.round(height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bumpMeasuredHeight = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0,
        doc.documentElement?.offsetHeight ?? 0,
        doc.body?.offsetHeight ?? 0,
      );
      if (h > 200) {
        setMeasuredIframeDocH(prev => Math.max(prev ?? 0, Math.round(h)));
      }
    } catch {
      /* cross-origin */
    }
  }, []);

  // Reset load state when switching URL or underlay mode
  useEffect(() => {
    setMeasuredIframeDocH(null);
    measureTimersRef.current.forEach(t => clearTimeout(t));
    measureTimersRef.current = [];
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    if (!showIframe || !url) {
      setLoadState('idle');
      return;
    }
    setLoadState('loading');
    loadTimerRef.current = setTimeout(() => {
      loadTimerRef.current = null;
      setLoadState(s => {
        if (s === 'loading') {
          queueMicrotask(() => onBlockedRef.current?.());
          return 'error';
        }
        return s;
      });
    }, 45_000);
    return () => {
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, [url, showIframe]);

  // Same-origin: keep iframe/canvas height in sync when layout, fonts, or SPA content settle.
  useEffect(() => {
    if (!showIframe || loadState !== 'loaded' || !url) return;
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    const t = window.setTimeout(() => {
      try {
        const doc = iframeRef.current?.contentDocument;
        const el = doc?.documentElement;
        if (!el || cancelled) return;
        const remeasure = () => bumpMeasuredHeight();
        ro = new ResizeObserver(remeasure);
        ro.observe(el);
        if (doc.body) ro.observe(doc.body);
        remeasure();
      } catch {
        /* cross-origin */
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
      ro?.disconnect();
    };
  }, [showIframe, loadState, url, bumpMeasuredHeight]);

  const onIframeLoad = () => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    bumpMeasuredHeight();
    requestAnimationFrame(bumpMeasuredHeight);
    requestAnimationFrame(() => requestAnimationFrame(bumpMeasuredHeight));
    const delays = [80, 250, 800, 2000];
    measureTimersRef.current.forEach(clearTimeout);
    measureTimersRef.current = delays.map(ms =>
      window.setTimeout(bumpMeasuredHeight, ms),
    );
    setLoadState('loaded');
  };

  const onIframeError = () => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setLoadState('error');
    onBlockedRef.current?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (heatType === 'scroll') {
      drawScrollHeatmap(canvas, points, dims.w, dims.h);
    } else {
      drawClickHeatmap(canvas, points, dims.w, dims.h);
    }
  }, [points, dims, heatType]);

  const showHeatOnlyFallback = !showIframe || loadState === 'error';
  const showLoadingOverlay   = showIframe && loadState === 'loading';

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-zinc-950">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div
          className="relative w-full"
          style={{ height: docPx, minHeight: docPx }}
        >
          {showIframe && url && (
            <iframe
              ref={iframeRef}
              key={url}
              src={url}
              className="absolute left-0 top-0 w-full border-0"
              onLoad={onIframeLoad}
              onError={onIframeError}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
              style={{ pointerEvents: 'none', height: docPx, minHeight: docPx }}
              title="Page preview"
            />
          )}

          {showHeatOnlyFallback && <HeatOnlyUnderlay />}

          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute left-0 top-0 z-20 transition-opacity duration-150"
            style={{
              mixBlendMode: 'screen',
              opacity: overlayOpacity,
              width: dims.w,
              height: dims.h,
            }}
            width={dims.w}
            height={dims.h}
          />

          {showLoadingOverlay && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/55 backdrop-blur-[1px]">
              <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/75 px-4 py-3 shadow-lg">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
                <p className="text-xs text-white/60">Loading page preview…</p>
                <p className="max-w-[220px] text-center text-[10px] leading-relaxed text-white/40">
                  Switch to <span className="text-white/55">Heat only</span> for an instant grid backdrop.
                </p>
              </div>
            </div>
          )}

          {showIframe && loadState === 'error' && (
            <div className="absolute left-1/2 top-3 z-30 max-w-[min(92vw,420px)] -translate-x-1/2">
              <div className="rounded-lg border border-amber-500/25 bg-zinc-950/90 px-3 py-2 shadow-lg backdrop-blur-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-zinc-100">Couldn’t embed this page</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-zinc-400">
                      Many sites block iframes (X-Frame-Options / CSP). Scroll to see the full heatmap — use{' '}
                      <span className="text-zinc-300">Heat only</span> or open the URL in a new tab.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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
  const { toast }  = useToast();

  const [heatType,  setHeatType]  = useState<HeatType>('click');
  const [device,    setDevice]    = useState<DeviceType>('all');
  const [customUrl, setCustomUrl] = useState('');
  const [liveUrl,   setLiveUrl]   = useState('');
  const [previewTouched, setPreviewTouched] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState([88]);
  const [previewUnderlay, setPreviewUnderlay] = useState<PreviewUnderlay>('iframe');

  const urlPath = slug ? decodeURIComponent(slug).replace(/_/g, '/') : '/';

  const demoPages = isDemoMode ? demoHeatmapPages() : [];
  const demoPage  = demoPages.find(p => p.url === urlPath) ?? demoPages[0];

  const { data: websiteMeta } = useQuery({
    queryKey:  ['website-meta', websiteId],
    queryFn:   () => getWebsiteByAnyId(websiteId),
    enabled:   !!websiteId && !isDemoMode,
    staleTime: 300_000,
  });

  const sitePreviewBase = useMemo(() => {
    const u = websiteMeta?.url?.trim();
    if (!u) return '';
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
    return normalizeWebsiteOriginForPreview(u, appOrigin);
  }, [websiteMeta]);

  const suggestedPreviewUrl = useMemo(() => {
    if (!sitePreviewBase) return '';
    const p = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
    return `${sitePreviewBase}${p}`;
  }, [sitePreviewBase, urlPath]);

  const { data: heatmapData, isLoading, isError, error, refetch } = useQuery({
    queryKey:  ['heatmap-data', websiteId, urlPath, heatType],
    queryFn:   () => getHeatmapData(websiteId, urlPath, heatType === 'scroll' ? 'scroll' : 'click'),
    enabled:   !isDemoMode,
    staleTime: 60_000,
  });

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
        nx:        p.x_percent / 10000,
        ny:        p.y_percent / 10000,
        intensity: p.intensity,
        selector:  p.target_selector || undefined,
        device:    p.device_type || 'desktop',
      }));

  const points: HeatPoint[] = device === 'all'
    ? allPoints
    : allPoints.filter(p => (p.device ?? 'desktop').toLowerCase() === device);

  const demoIframeFallback =
    typeof window !== 'undefined' && isDemoMode
      ? `${window.location.origin}${demoPage?.url ?? '/'}`
      : '';

  useEffect(() => {
    if (previewTouched) return;
    if (isDemoMode && demoIframeFallback) {
      setLiveUrl(demoIframeFallback);
      return;
    }
    if (!isDemoMode && suggestedPreviewUrl) setLiveUrl(suggestedPreviewUrl);
  }, [isDemoMode, demoIframeFallback, suggestedPreviewUrl, previewTouched]);

  const displayIframeUrl = liveUrl || suggestedPreviewUrl || demoIframeFallback;

  const applyUrl = () => {
    const t = customUrl.trim();
    if (!t) return;
    setPreviewTouched(true);
    setLiveUrl(t.startsWith('http') ? t : `https://${t}`);
  };

  const resetPreviewUrl = () => {
    setPreviewTouched(false);
    setCustomUrl('');
    if (isDemoMode && demoIframeFallback) setLiveUrl(demoIframeFallback);
    else setLiveUrl(suggestedPreviewUrl);
  };

  const shareHeatmapPath = `/websites/${websiteId}/heatmaps/${heatmapPageSlug(urlPath)}`;
  const copyShareLink = () => {
    const full =
      typeof window !== 'undefined' ? `${window.location.origin}${shareHeatmapPath}` : shareHeatmapPath;
    void navigator.clipboard.writeText(full).then(() => {
      toast({ title: 'Link copied', description: 'Anyone with access can open this heatmap.' });
    });
  };

  const pathForHeading = isDemoMode ? (demoPage?.url ?? urlPath) : urlPath;
  const { title: pageTitle, subtitle: pageSubtitle } = heatmapPageHeading(
    pathForHeading || '/',
    isDemoMode ? undefined : websiteId,
  );

  const ControlPill = (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border/50 bg-muted/25 px-0.5 py-0.5">
      <div className="flex rounded-md p-px">
        {([['click', MousePointer, 'Clicks'], ['scroll', TrendingDown, 'Scroll']] as const).map(
          ([type, Icon, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setHeatType(type)}
              className={cn(
                'flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11px] font-normal transition-colors',
                heatType === type
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3 opacity-70" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ),
        )}
      </div>
      <Select value={device} onValueChange={v => setDevice(v as DeviceType)}>
        <SelectTrigger className="h-7 w-[104px] border-0 bg-transparent text-[11px] font-normal shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All devices</SelectItem>
          <SelectItem value="desktop" className="text-xs">Desktop</SelectItem>
          <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
          <SelectItem value="tablet" className="text-xs">Tablet</SelectItem>
        </SelectContent>
      </Select>
      <div className="mx-0.5 hidden h-4 w-px bg-border/60 sm:block" />
      <div className="flex rounded-md p-px">
        {([
          ['iframe', Monitor, 'Page'],
          ['heat-only', Layers, 'Heat'],
        ] as const).map(([mode, Icon, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPreviewUnderlay(mode)}
            className={cn(
              'flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11px] font-normal transition-colors',
              previewUnderlay === mode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3 w-3 opacity-70" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {isError && !isDemoMode && (
        <div className="shrink-0 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          {(error as Error)?.message ?? 'Failed to load heatmap data.'}
        </div>
      )}

      <header className="shrink-0 border-b border-border/40 bg-background/80 px-3 py-2 backdrop-blur-sm md:px-5">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => router.push(`/websites/${websiteId}/heatmaps`)}
              aria-label="Back to heatmaps"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="truncate text-sm font-medium text-foreground">
                  {pageTitle}
                </h1>
                {isDemoMode && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">Demo</Badge>
                )}
              </div>
              <p
                className="truncate text-[11px] font-normal text-muted-foreground"
                title={urlPath.startsWith('/') ? urlPath : `/${urlPath}`}
              >
                {pageSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <div className="hidden sm:block">{ControlPill}</div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] font-normal sm:hidden">
                  View
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Data mode
                </DropdownMenuLabel>
                <DropdownMenuItem className="text-xs" onClick={() => setHeatType('click')}>
                  Clicks {heatType === 'click' ? ' ✓' : ''}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => setHeatType('scroll')}>
                  Scroll depth {heatType === 'scroll' ? ' ✓' : ''}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Preview
                </DropdownMenuLabel>
                <DropdownMenuItem className="text-xs" onClick={() => setPreviewUnderlay('iframe')}>
                  With page {previewUnderlay === 'iframe' ? ' ✓' : ''}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => setPreviewUnderlay('heat-only')}>
                  Heat only {previewUnderlay === 'heat-only' ? ' ✓' : ''}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] font-normal text-muted-foreground hover:text-foreground">
                  <Link2 className="h-3 w-3" />
                  <span className="hidden md:inline">URL</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,380px)] p-3" align="end">
                <p className="mb-2 text-xs text-muted-foreground">
                  Match your live page so the underlay lines up with the heat layer.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={customUrl}
                    onChange={e => setCustomUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyUrl()}
                    placeholder={displayIframeUrl || 'https://…'}
                    className="h-9 font-mono text-xs"
                  />
                  <Button type="button" size="sm" className="h-9 shrink-0" onClick={applyUrl}>
                    Apply
                  </Button>
                </div>
                <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 w-full text-xs" onClick={resetPreviewUrl}>
                  Reset to suggested URL
                </Button>
              </PopoverContent>
            </Popover>

            {!isDemoMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label="More actions">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs" onClick={copyShareLink}>
                    Copy link to this heatmap
                  </DropdownMenuItem>
                  {displayIframeUrl ? (
                    <DropdownMenuItem
                      className="text-xs"
                      onClick={() => window.open(displayIframeUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open preview in new tab
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem className="text-xs" onClick={() => refetch()}>
                    Refresh data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] px-3 pb-2 sm:hidden md:px-5">{ControlPill}</div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 pb-4 pt-1 md:px-6">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-muted/30 shadow-sm">
          {!displayIframeUrl && !isDemoMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Flame className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">Add a preview URL</p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                Set the site URL in settings or use <span className="font-medium text-foreground">Preview URL</span> above.
              </p>
            </div>
          ) : points.length === 0 && !isLoading && !isDemoMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Flame className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">No data for this page yet</p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {heatType === 'click'
                  ? 'Clicks will show here after visitors interact with this path.'
                  : 'Scroll milestones appear after visitors scroll this page.'}
              </p>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1">
                <HeatmapViewer
                  key={`${websiteId}:${urlPath}`}
                  url={displayIframeUrl}
                  points={points}
                  heatType={heatType}
                  overlayOpacity={overlayOpacity[0] / 100}
                  underlay={previewUnderlay}
                  onUnderlayBlocked={() => setPreviewUnderlay('heat-only')}
                />
              </div>
              {!!points.length && (
                <footer className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 bg-background/80 px-4 py-2.5">
                  {heatType === 'click' ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="hidden sm:inline">Intensity</span>
                      <div
                        className="h-2 w-28 max-w-[40vw] rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, rgba(0,62,255,0.35), rgba(0,255,144,0.45), rgba(255,230,0,0.55), rgba(255,0,0,0.65))',
                        }}
                      />
                      <span className="text-[10px]">low → high</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="hidden sm:inline">Depth</span>
                      <div
                        className="h-2 w-28 max-w-[40vw] rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, rgba(0,170,85,0.45), rgba(0,85,255,0.35))',
                        }}
                      />
                      <span className="text-[10px]">shallow → deep</span>
                    </div>
                  )}
                  {displayIframeUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Overlay</span>
                      <Slider
                        value={overlayOpacity}
                        onValueChange={setOverlayOpacity}
                        min={25}
                        max={100}
                        step={5}
                        className="w-[88px] md:w-[120px]"
                        aria-label="Heatmap overlay opacity"
                      />
                    </div>
                  ) : null}
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {points.length.toLocaleString()} pts
                    {isDemoMode ? ' · demo' : ''}
                  </span>
                </footer>
              )}
            </>
          )}

          {isLoading && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/85 px-4 py-2 shadow-md backdrop-blur-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <span className="text-xs font-medium">Loading…</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
