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
  ArrowLeft, MousePointer,
  AlertTriangle, RefreshCw, Monitor,
  TrendingDown, Layers, Link2,
  MoreHorizontal,
  ChevronLeft, ChevronRight,
  Lock, ExternalLink,
} from 'lucide-react';
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
      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-muted/50"
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.45] dark:opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 90% 45% at 50% 0%, hsl(var(--primary) / 0.07), transparent 55%),
            linear-gradient(hsl(var(--border) / 0.45) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.45) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-sm rounded-lg border border-border/70 bg-card/95 px-4 py-4 text-center">
          <p className="text-sm font-medium text-foreground">Heat layer only</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Neutral grid under the heatmap. Open the live page in another tab to compare layout.
          </p>
        </div>
      </div>
    </div>
  );
}

type PreviewUnderlay = 'iframe' | 'heat-only';

/** Single-row browser-style chrome (traffic dots, nav, omnibox, open). */
function HeatmapPreviewBrowserChrome({
  pageUrl,
  underlay,
  loadState,
}: {
  pageUrl: string;
  underlay: PreviewUnderlay;
  loadState: 'idle' | 'loading' | 'loaded' | 'error';
}) {
  const displayUrl = pageUrl.trim() || '—';
  const secure     = /^https:\/\//i.test(pageUrl);
  const statusLead =
    underlay === 'heat-only'
      ? 'Heat only · '
      : loadState === 'error'
        ? 'Blocked · '
        : loadState === 'loading'
          ? 'Loading · '
          : '';
  const barTitle = `${statusLead}${displayUrl}`;

  const openExternal = () => {
    if (!pageUrl.trim()) return;
    window.open(pageUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800/90 bg-zinc-900 px-1.5">
      <div className="flex shrink-0 gap-1 px-0.5" aria-hidden>
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
      </div>
      <button
        type="button"
        disabled
        className="shrink-0 rounded p-1 text-zinc-600 opacity-60"
        aria-hidden
        tabIndex={-1}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled
        className="shrink-0 rounded p-1 text-zinc-600 opacity-60"
        aria-hidden
        tabIndex={-1}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-950/90 px-2 py-0.5">
        {secure ? (
          <Lock className="h-3 w-3 shrink-0 text-emerald-500/90" aria-hidden />
        ) : (
          <span className="w-3 shrink-0 text-center text-[9px] text-zinc-500" aria-hidden>
            ··
          </span>
        )}
        <p className="min-w-0 truncate font-mono text-[11px] leading-snug text-zinc-400" title={barTitle}>
          {statusLead ? <span className="text-zinc-500">{statusLead}</span> : null}
          <span className="text-zinc-400">{displayUrl}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={openExternal}
        disabled={!pageUrl.trim()}
        className="shrink-0 rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-35"
        title="Open in new tab"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

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
  const measureTimersRef = useRef<number[]>([]);
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
    <div className="flex h-full min-h-0 w-full flex-col bg-[#09090b] dark:bg-[#09090b]">
      <HeatmapPreviewBrowserChrome pageUrl={url} underlay={underlay} loadState={loadState} />
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
      <div>
        <p className="text-sm font-medium text-foreground">Preview URL</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Must match this path so clicks and scroll line up with the iframe.
        </p>
      </div>
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
      <Button type="button" variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={resetPreviewUrl}>
        Reset to suggested
      </Button>
    </>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {isError && !isDemoMode && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {(error as Error)?.message ?? 'Failed to load heatmap data.'}
        </div>
      )}

      <header className="shrink-0 border-b border-border bg-background">
        <div
          className="mx-auto flex max-w-[1800px] items-center gap-2 overflow-x-auto px-2 py-1.5 md:px-4"
          role="toolbar"
          aria-label="Heatmap"
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push(`/websites/${websiteId}/heatmaps`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Heatmaps
          </Button>
          {isDemoMode ? (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] font-medium">
              Demo
            </Badge>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
            {points.length > 0 ? (
              <span className="shrink-0 tabular-nums">{points.length.toLocaleString()} pts</span>
            ) : null}
            {points.length > 0 ? <span className="shrink-0 text-border" aria-hidden>·</span> : null}
            <code className="min-w-0 truncate font-mono text-[10px] sm:text-[11px]" title={heatmapPathLine}>
              {heatmapPathLine}
            </code>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8" title="Preview URL" aria-label="Preview URL">
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,380px)] space-y-3 p-4" align="end">
                {previewUrlPopoverInner}
              </PopoverContent>
            </Popover>

            <div className="flex rounded-md border border-border bg-background p-0.5">
              {([
                ['click', MousePointer, 'Clicks', 'Where people click'],
                ['scroll', TrendingDown, 'Scroll', 'How far they scroll'],
              ] as const).map(([type, Icon, label, hint]) => (
                <button
                  key={type}
                  type="button"
                  title={hint}
                  onClick={() => setHeatType(type)}
                  className={cn(
                    'flex items-center gap-1 rounded-[4px] px-1.5 py-1 text-[11px] font-medium transition-colors sm:px-2 sm:text-xs',
                    heatType === type
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3 w-3 opacity-80" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <Select value={device} onValueChange={v => setDevice(v as DeviceType)}>
              <SelectTrigger
                className="h-8 w-[108px] rounded-md border-border bg-background px-2 text-[11px] font-medium shadow-none sm:w-32 sm:text-xs"
                title="Device"
              >
                <SelectValue placeholder="Device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All devices</SelectItem>
                <SelectItem value="desktop" className="text-xs">Desktop</SelectItem>
                <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
                <SelectItem value="tablet" className="text-xs">Tablet</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-md border border-border bg-background p-0.5">
              {([
                ['iframe', Monitor, 'Page preview', 'Live page under heatmap'] as const,
                ['heat-only', Layers, 'Heat only', 'Heat only, no iframe'] as const,
              ]).map(([mode, Icon, label, hint]) => (
                <button
                  key={mode}
                  type="button"
                  title={hint}
                  onClick={() => setPreviewUnderlay(mode)}
                  className={cn(
                    'flex items-center gap-1 rounded-[4px] px-1.5 py-1 text-[11px] font-medium transition-colors sm:px-2 sm:text-xs',
                    previewUnderlay === mode
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3 w-3 opacity-80" />
                  {mode === 'iframe' ? (
                    <>
                      <span className="sm:hidden">Preview</span>
                      <span className="hidden sm:inline">{label}</span>
                    </>
                  ) : (
                    <span>{label}</span>
                  )}
                </button>
              ))}
            </div>

            {!isDemoMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="More">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem className="text-xs" onClick={copyShareLink}>
                    Copy link
                  </DropdownMenuItem>
                  {displayIframeUrl ? (
                    <DropdownMenuItem
                      className="text-xs"
                      onClick={() => window.open(displayIframeUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Open preview tab
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem className="text-xs" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Refresh data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col px-2 pb-2 pt-1.5 md:px-4 md:pb-3 md:pt-2">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
          {!displayIframeUrl && !isDemoMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">Add a page preview URL</p>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                Set your site URL in Settings, or use Preview URL above so the heatmap aligns with your page.
              </p>
            </div>
          ) : points.length === 0 && !isLoading && !isDemoMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No data for this view yet</p>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                {heatType === 'click'
                  ? 'Clicks will appear after visitors use this path. Check heatmaps are enabled in Settings.'
                  : 'Scroll depth appears after traffic. Try Clicks if you expect visitors but see nothing here.'}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <HeatmapViewer
                key={`${websiteId}:${urlPath}`}
                url={displayIframeUrl}
                points={points}
                heatType={heatType}
                underlay={previewUnderlay}
                onUnderlayBlocked={() => setPreviewUnderlay('heat-only')}
              />
            </div>
          )}

          {isLoading && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/50">
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                <span className="text-xs font-medium text-foreground">Loading…</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
