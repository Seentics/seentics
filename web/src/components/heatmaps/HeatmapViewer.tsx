'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';



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
import { ChevronLeft, ChevronRight, Lock, ExternalLink } from 'lucide-react';
import { DemoHeatmapPage } from '@/components/heatmaps/DemoHeatmapPage';

import { demoHeatmapPages, demoHeatmapPoints } from '@/lib/demo/heatmaps';
import {
  clampLayoutPx,
  heatmapCaptureBox,
  heatmapPreviewScale,
  HEATMAP_DIM_CAP,
  MIN_CAPTURE_PX,
} from '@/lib/heatmaps/preview-geometry';



import { clampHeatmapPreviewDimensions, documentPixelHeightForHeatmap, documentPixelWidthForHeatmap, heatmapDocHeightHintPx, type HeatPoint, type HeatType } from '@/features/heatmaps/preview-math';
import { drawClickHeatmap, drawScrollHeatmap } from '@/features/heatmaps/canvas';
import type { HeatmapPageScreenshot } from '@/features/heatmaps/types';


export function HeatOnlyUnderlay() {
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
        <div className="max-w-sm rounded-lg border border-border bg-card/95 px-4 py-4 text-center">
          <p className="text-sm font-medium text-foreground">Heat layer only</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Neutral grid under the heatmap. Open the live page in another tab to compare layout.
          </p>
        </div>
      </div>
    </div>
  );
}

export type PreviewUnderlay = 'screenshot' | 'heat-only';

/** Single-row browser-style chrome (traffic dots, nav, omnibox, open). */
export function HeatmapPreviewBrowserChrome({
  pageUrl,
  underlay,
  loadState,
  usingPageVisual = false,
  capturedOn = null,
  requestedDevice = 'all',
}: {
  pageUrl: string;
  underlay: PreviewUnderlay;
  loadState: 'idle' | 'loading' | 'loaded' | 'error';
  /** True when showing a captured screenshot or live page under the heat layer. */
  usingPageVisual?: boolean;
  /**
   * Bucket the shown background was captured on, when it is not the one asked for.
   * A responsive page reflows between buckets, so the dots sit on a layout that is
   * close but not the one those visitors saw — worth saying out loud rather than
   * presenting an approximate overlay as exact.
   */
  capturedOn?: string | null;
  requestedDevice?: string;
}) {
  const displayUrl = pageUrl.trim() || '—';
  const secure     = /^https:\/\//i.test(pageUrl);
  const showFallbackNote =
    usingPageVisual && !!capturedOn && requestedDevice !== 'all' && loadState !== 'loading';
  const statusLead =
    underlay === 'heat-only'
      ? 'Heat only · '
      : usingPageVisual
        ? loadState === 'loading'
          ? 'Loading screenshot · '
          : showFallbackNote
            ? `${capturedOn} screenshot · `
            : 'Captured screenshot · '
        : 'No screenshot yet · ';
  const barTitle = showFallbackNote
    ? `No ${requestedDevice} capture yet — showing the ${capturedOn} one, so the layout under the points is approximate. ${displayUrl}`
    : `${statusLead}${displayUrl}`;

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
        className="shrink-0 rounded-lg p-1 text-zinc-600 opacity-60"
        aria-hidden
        tabIndex={-1}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled
        className="shrink-0 rounded-lg p-1 text-zinc-600 opacity-60"
        aria-hidden
        tabIndex={-1}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-2 py-0.5">
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
        className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-35"
        title="Open in new tab"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Canvas overlay ───────────────────────────────────────────────────────────
/**
 * The stage, in demo mode.
 *
 * Deliberately not `HeatmapViewer`. That component's whole job is to line recorded
 * points up with a captured snapshot — it measures the snapshot's natural size, picks
 * a document height from stored `doc_height`, and paints two canvas passes at those
 * dimensions. Demo mode has no snapshot and no real points, so every one of those
 * inputs would be a guess, and the guess is what produced the old screen: blobs
 * scattered over an empty grid under the words "No screenshot yet".
 *
 * Here the page is a component of known size carrying its own heat, so there is
 * nothing to align and no canvas to paint. The Clicks/Scroll toggle still works — it
 * swaps the layer inside `DemoHeatmapPage` — while the device selector does not,
 * since there is only one rendering of the page.
 */
export function DemoHeatmapStage({ pageUrl, heatType }: { pageUrl: string; heatType: HeatType }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-muted dark:bg-[#09090b]">
      <HeatmapPreviewBrowserChrome
        pageUrl={pageUrl}
        underlay="screenshot"
        loadState="loaded"
        usingPageVisual
      />
      <div className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto p-5">
        <div className="mx-auto w-full max-w-[860px] overflow-hidden rounded-lg border border-border shadow-[0_20px_50px_-15px_rgba(0,0,0,0.45)]">
          <DemoHeatmapPage heat={heatType === 'scroll' ? 'scroll' : 'click'} />
        </div>
      </div>
    </div>
  );
}

export function HeatmapViewer({
  pageUrl,
  points,
  heatType,
  overlayOpacity = 1,
  underlay,
  preferredViewportWidth = null,
  pageScreenshot = null,
  requestedDevice = 'all',
}: {
  pageUrl: string;
  points: HeatPoint[];
  heatType: HeatType;
  overlayOpacity?: number;
  underlay: PreviewUnderlay;
  /** Device bucket the viewer asked for, so the chrome can flag a fallback background. */
  requestedDevice?: string;
  preferredViewportWidth?: number | null;
  pageScreenshot?: HeatmapPageScreenshot | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [viewPort, setViewPort] = useState<{ w: number; h: number }>({ w: 1280, h: 0 });
  /** Natural size when loaded — from JPEG naturalWidth/Height or HTML iframe scrollWidth/Height. */
  const [shotNatural, setShotNatural] = useState<{ w: number; h: number } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const hasHtmlSnapshot = !!pageScreenshot?.html_url?.trim();
  const hasJpegSnapshot = !!pageScreenshot?.image_url?.trim();
  const screenshotActive =
    underlay === 'screenshot' && (hasHtmlSnapshot || hasJpegSnapshot);

  const docHeightHint = useMemo(
    () => heatmapDocHeightHintPx(points, heatType, viewPort.w),
    [points, heatType, viewPort.w],
  );

  /**
   * The layout box the stored background was captured at, in CSS pixels.
   *
   * This is the coordinate system the points live in: the tracker divides each click's
   * page position by the document it measured, and stores that same document as
   * `doc_width`/`doc_height` alongside the snapshot. Rendering at this box is what makes
   * `nx * width` land on the element that was clicked.
   *
   * Deliberately *not* derived from the rendered iframe. That measurement is circular —
   * the iframe is laid out at whatever width the panel happens to give it, a responsive
   * page reflows to match, and it then reports that reflowed size back as if it were
   * intrinsic. Trusting it produced a different canvas on every load of the same page
   * (849x4096 one render, 1048x1272 the next, against a page captured at 1470x1256),
   * which no fixed offset could correct.
   */
  const captureBox = useMemo(
    () => heatmapCaptureBox(pageScreenshot, shotNatural),
    [pageScreenshot, shotNatural],
  );

  const docPx = useMemo(() => {
    if (captureBox) return Math.min(HEATMAP_DIM_CAP, captureBox.h);
    // No snapshot at all — heat-only mode. Nothing constrains the canvas but the data,
    // so estimate the page height from how far down the clicks and scrolls reach.
    const dataH = documentPixelHeightForHeatmap(points, heatType, viewPort.w, null);
    return Math.min(HEATMAP_DIM_CAP, Math.max(dataH, docHeightHint));
  }, [captureBox, points, heatType, viewPort.w, docHeightHint]);

  /**
   * The layout box everything is positioned in: the iframe's CSS width, the canvas's CSS
   * size, and the space `nx * w, ny * h` maps into. It is the capture box exactly —
   * never clamped. Clamping this is what a memory cap must not do, because shrinking the
   * width reflows the responsive page inside the iframe and moves every element out from
   * under its dots. Oversized previews are handled by `previewScale` (a CSS transform,
   * which scales without reflowing) and by `canvasRes` (fewer pixels, same box).
   */
  const dims = useMemo(() => {
    if (captureBox) {
      return { w: clampLayoutPx(captureBox.w), h: clampLayoutPx(docPx) };
    }
    const dataW = documentPixelWidthForHeatmap(points, viewPort.w);
    const captureW =
      preferredViewportWidth != null &&
      preferredViewportWidth >= MIN_CAPTURE_PX &&
      preferredViewportWidth <= HEATMAP_DIM_CAP
        ? preferredViewportWidth
        : 0;
    const w = Math.max(MIN_CAPTURE_PX, viewPort.w, dataW, captureW);
    return { w: clampLayoutPx(w), h: clampLayoutPx(docPx) };
  }, [captureBox, docPx, viewPort.w, points, preferredViewportWidth]);

  /**
   * Backing-store resolution for the heat canvas, capped so a tall page cannot allocate a
   * multi-megapixel surface and freeze the tab. The canvas is still *displayed* at
   * `dims`, so a lower resolution costs sharpness and nothing else — the layer is soft
   * radial gradients, which survive downscaling without a visible seam.
   */
  const canvasRes = useMemo(() => clampHeatmapPreviewDimensions(dims.w, dims.h), [dims]);

  const previewScale = useMemo(
    () => heatmapPreviewScale(dims.w, viewPort.w),
    [viewPort.w, dims.w],
  );

  const scaledOuterW = Math.max(1, Math.round(dims.w * previewScale));
  const scaledOuterH = Math.max(1, Math.round(dims.h * previewScale));

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

  useEffect(() => {
    if (underlay === 'heat-only') {
      setLoadState('idle');
      return;
    }
    if (screenshotActive && (pageScreenshot?.html_url || pageScreenshot?.image_url)) {
      setLoadState('loading');
    } else {
      setLoadState('idle');
    }
  }, [underlay, screenshotActive, pageScreenshot?.html_url, pageScreenshot?.image_url, pageUrl]);

  useEffect(() => {
    setShotNatural(null);
  }, [pageScreenshot?.image_url, pageScreenshot?.html_url, underlay, screenshotActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (heatType === 'scroll') {
      drawScrollHeatmap(canvas, points, canvasRes.w, canvasRes.h);
    } else {
      drawClickHeatmap(canvas, points, canvasRes.w, canvasRes.h);
    }
  }, [points, canvasRes, heatType]);

  // Listen for the postMessage sent by the injected measurement script inside the HTML
  // snapshot iframe. The snapshot is served from S3 (cross-origin), so contentDocument
  // is inaccessible — postMessage is the only way to get the actual rendered height.
  useEffect(() => {
    if (!hasHtmlSnapshot) return;
    const handler = (e: MessageEvent) => {
      if (!iframeRef.current) return;
      if (e.source !== iframeRef.current.contentWindow) return;
      if (!e.data || typeof e.data !== 'object' || e.data.type !== 'snc_snap_dims') return;
      const h = typeof e.data.h === 'number' && Number.isFinite(e.data.h) ? Math.round(e.data.h) : 0;
      const w = typeof e.data.w === 'number' && Number.isFinite(e.data.w) ? Math.round(e.data.w) : 0;
      if (h > 100) setShotNatural({ w: w > 200 ? w : dims.w, h });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [hasHtmlSnapshot, dims.w]);

  const showHeatOnlyFallback = underlay === 'heat-only' || !screenshotActive;
  const showLoadingOverlay = screenshotActive && loadState === 'loading';

  return (
    /*
      The stage the preview sits on follows the theme.

      It was `bg-[#09090b] dark:bg-[#09090b]` — the same near-black in both themes,
      which meant the one surface on the page that ignored the theme entirely. The
      intent was sound: the visitor's own page is rendered inside this, and a darker
      surround makes a white page read as a distinct artifact rather than blending
      into the dashboard. But that only needs the stage to be *darker than the page
      inside it*, which a neutral grey achieves in light mode without dropping a
      black rectangle into a light UI.
    */
    <div className="flex h-full min-h-0 w-full flex-col bg-muted dark:bg-[#09090b]">
      <HeatmapPreviewBrowserChrome
        pageUrl={pageUrl}
        underlay={underlay}
        loadState={loadState}
        usingPageVisual={screenshotActive}
        capturedOn={pageScreenshot?.device_fallback ? (pageScreenshot.device_type ?? null) : null}
        requestedDevice={requestedDevice}
      />
      <div
        ref={scrollRef}
        className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div
          className="relative mx-auto shrink-0 overflow-hidden"
          style={{
            width: scaledOuterW,
            minWidth: scaledOuterW,
            height: scaledOuterH,
            minHeight: scaledOuterH,
          }}
        >
          <div
            className="relative"
            style={{
              width: dims.w,
              minWidth: dims.w,
              height: dims.h,
              minHeight: dims.h,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
            }}
          >
            {screenshotActive && pageScreenshot ? (
              <div
                className="absolute left-0 top-0 z-0 overflow-hidden bg-white"
                style={{
                  width: dims.w,
                  minWidth: dims.w,
                  height: dims.h,
                  minHeight: dims.h,
                }}
              >
                {hasHtmlSnapshot && pageScreenshot.html_url ? (
                  <iframe
                    ref={iframeRef}
                    src={pageScreenshot.html_url}
                    title="Page snapshot"
                    sandbox="allow-same-origin allow-scripts"
                    scrolling="no"
                    className="pointer-events-none block border-0"
                    style={{ width: dims.w, height: dims.h }}
                    onLoad={() => {
                      setLoadState('loaded');
                      try {
                        const doc = iframeRef.current?.contentDocument;
                        if (!doc) return;
                        const h = doc.documentElement.scrollHeight;
                        const w = doc.documentElement.scrollWidth;
                        if (h > 100) setShotNatural({ w: w > 200 ? w : dims.w, h });
                      } catch { /* cross-origin guard */ }
                    }}
                    onError={() => setLoadState('error')}
                  />
                ) : pageScreenshot.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pageScreenshot.image_url}
                    alt=""
                    className="pointer-events-none block h-full w-full object-fill"
                    onLoad={e => {
                      const im = e.currentTarget;
                      setShotNatural({
                        w: Math.max(1, im.naturalWidth),
                        h: Math.max(1, im.naturalHeight),
                      });
                      setLoadState('loaded');
                    }}
                    onError={() => setLoadState('error')}
                    loading="eager"
                    decoding="async"
                  />
                ) : null}
              </div>
            ) : null}

            {showHeatOnlyFallback ? <HeatOnlyUnderlay /> : null}

            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute left-0 top-0 z-20 transition-opacity duration-150"
              style={{
                mixBlendMode: 'normal',
                opacity: overlayOpacity,
                width: dims.w,
                height: dims.h,
              }}
              width={canvasRes.w}
              height={canvasRes.h}
            />

            {showLoadingOverlay && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/55 backdrop-blur-[1px]">
                <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/75 px-4 py-3 shadow-lg">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
                  <p className="text-xs text-white/60">Loading screenshot…</p>
                  <p className="max-w-[220px] text-center text-[10px] leading-relaxed text-white/40">
                    Switch to <span className="text-white/55">Heat only</span> for an instant grid backdrop.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
