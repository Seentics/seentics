'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPageIcon } from '@/components/analytics/page-icon';
import { DemoHeatmapPage, DEMO_HEATMAP_PAGE_HEIGHT } from '@/components/heatmaps/DemoHeatmapPage';
import { drawClickHeatmap, drawScrollHeatmap } from '@/features/heatmaps/canvas';
import { getHeatmapData, getHeatmapPageScreenshot } from '@/features/heatmaps/api';
import { scrollReachPoints, type HeatPoint } from '@/features/heatmaps/preview-math';
import type { HeatmapPoint } from '@/features/heatmaps/types';

export type ThumbMode = 'clicks' | 'scroll';
export type ThumbDevice = 'desktop' | 'mobile';

/** The demo page is drawn at this width and scaled into the card. */
const DEMO_PAGE_WIDTH = 720;

/** The card's preview is 4:3. */
const ASPECT = 3 / 4;

/** Watches an element's width, for drawing the heat layer at the card's real size. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Where half of the visitors who arrived had stopped scrolling, as a fraction of the page,
 * from the reach curve (each point: how many got at least that far down).
 */
function halfStopDepth(reach: HeatPoint[]): number | null {
  const top = reach[0]?.intensity ?? 0;
  if (!top) return null;
  const below = reach.find((p) => p.intensity < top / 2);
  return below ? below.ny : 1;
}

/**
 * A page's preview in the gallery: its stored screenshot with this period's heat on it —
 * clicks over the top of the page, or scroll depth down the whole of it.
 *
 * The demo site has no captures, so it shows the illustrated demo page, scaled down, as
 * the heatmap detail screen does.
 */
export function HeatmapThumbnail({
  websiteId, url, days, mode, device, demo, demoReach,
}: {
  websiteId: string;
  url: string;
  days: number;
  mode: ThumbMode;
  device: ThumbDevice;
  demo: boolean;
  /** The demo page's share past halfway, for its scroll line. */
  demoReach?: number | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = Math.round(width * ASPECT);

  if (demo) {
    return (
      <div ref={ref} className="relative aspect-[4/3] overflow-hidden bg-muted/40">
        {width > 0 && <DemoThumb width={width} height={height} mode={mode} reach={demoReach ?? null} />}
      </div>
    );
  }
  return (
    <div ref={ref} className="relative aspect-[4/3] overflow-hidden bg-muted/40">
      {width > 0 && <LiveThumb websiteId={websiteId} url={url} days={days} mode={mode} device={device} width={width} height={height} />}
    </div>
  );
}

function DemoThumb({ width, height, mode, reach }: { width: number; height: number; mode: ThumbMode; reach: number | null }) {
  if (mode === 'clicks') {
    // The top of the page, at the card's width.
    const scale = width / DEMO_PAGE_WIDTH;
    return (
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: DEMO_PAGE_WIDTH, transform: `scale(${scale})` }}>
        <DemoHeatmapPage heat="click" />
      </div>
    );
  }
  // The whole page, fitted to the card's height, with how far people got down it.
  const scale = height / DEMO_HEATMAP_PAGE_HEIGHT;
  const stripWidth = DEMO_PAGE_WIDTH * scale;
  const fold = Math.min(0.95, Math.max(0.1, (reach ?? 50) / 100));
  return (
    <div aria-hidden className="absolute inset-y-0 left-1/2 -translate-x-1/2 overflow-hidden border-x border-border" style={{ width: stripWidth }}>
      <div className="pointer-events-none origin-top-left" style={{ width: DEMO_PAGE_WIDTH, transform: `scale(${scale})` }}>
        <DemoHeatmapPage heat="scroll" />
      </div>
      <ScrollShade fold={fold} />
    </div>
  );
}

/** A warm-to-cold wash down the page and a line where half the visitors stop. */
function ScrollShade({ fold }: { fold: number }) {
  const pct = Math.round(fold * 100);
  return (
    <>
      <span
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, rgba(239,68,68,.42) 0%, rgba(250,170,30,.36) ${Math.round(pct * 0.55)}%, rgba(250,220,60,.3) ${pct}%, rgba(59,130,246,.38) ${Math.min(100, pct + 18)}%, rgba(20,22,30,.55) 100%)` }}
      />
      <span className="absolute inset-x-0 border-t-2 border-dashed border-white" style={{ top: `${pct}%` }} />
    </>
  );
}

function LiveThumb({
  websiteId, url, days, mode, device, width, height,
}: { websiteId: string; url: string; days: number; mode: ThumbMode; device: ThumbDevice; width: number; height: number }) {
  const shot = useQuery({
    queryKey: ['heatmap-thumb-shot', websiteId, url, device],
    queryFn: () => getHeatmapPageScreenshot(websiteId, url, device),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
  const eventType = mode === 'clicks' ? 'click' : 'scroll';
  const data = useQuery({
    queryKey: ['heatmap-thumb-points', websiteId, url, eventType, days],
    queryFn: () => getHeatmapData(websiteId, url, eventType, days),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  /** This device's points, as the detail page reads them. */
  const points: HeatPoint[] = useMemo(() => (data.data?.points ?? [])
    .filter((p: HeatmapPoint) => (p.device_type || 'desktop').toLowerCase() === device)
    .map((p: HeatmapPoint) => ({
      nx: p.x_percent / 10000,
      ny: eventType === 'scroll' ? Math.min(1, Math.max(0, (p.y_percent ?? 0) / 100)) : (p.y_percent ?? 0) / 10000,
      intensity: p.intensity,
    })), [data.data, device, eventType]);

  const image = shot.data?.image_url;
  const docW = shot.data?.doc_width ?? 0;
  const docH = shot.data?.doc_height ?? 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The page at the card's width: how tall it is there, and which clicks land in the top.
  const pageHeight = image && docW > 0 ? Math.round(width * (docH / docW)) : 0;
  const reach = useMemo(() => (mode === 'scroll' ? scrollReachPoints(points) : []), [mode, points]);
  const stripWidth = mode === 'scroll' && pageHeight > 0 ? Math.max(40, Math.round(height * (docW / docH))) : Math.round(width * 0.42);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (mode === 'clicks') {
      if (!pageHeight) return;
      const visible = points
        .filter((p) => p.ny * pageHeight <= height + 30)
        .map((p) => ({ ...p, ny: (p.ny * pageHeight) / height }));
      drawClickHeatmap(canvas, visible, width, height);
    } else {
      drawScrollHeatmap(canvas, reach, stripWidth, height);
    }
  }, [mode, points, reach, width, height, pageHeight, stripWidth]);

  if (mode === 'clicks') {
    if (!image) return <Placeholder url={url} loading={shot.isLoading} />;
    return (
      <>
        <img src={image} alt="" loading="lazy" className="absolute left-0 top-0 w-full" />
        <span className="absolute inset-0 bg-black/15" />
        <canvas ref={canvasRef} aria-hidden className="absolute left-0 top-0" style={{ width, height }} />
      </>
    );
  }

  // Scroll: the whole page as a strip down the card, with how far people got.
  const fold = halfStopDepth(reach);
  if (!reach.length && !shot.isLoading && !data.isLoading) return <Placeholder url={url} loading={false} />;
  return (
    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 overflow-hidden border-x border-border bg-card" style={{ width: stripWidth }}>
      {image && <img src={image} alt="" loading="lazy" className="absolute left-0 top-0 size-full object-fill" />}
      <canvas ref={canvasRef} aria-hidden className="absolute left-0 top-0" style={{ width: stripWidth, height }} />
      {fold != null && <span className="absolute inset-x-0 border-t-2 border-dashed border-white" style={{ top: `${Math.round(fold * 100)}%` }} />}
    </div>
  );
}

function Placeholder({ url, loading }: { url: string; loading: boolean }) {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground [&_svg]:size-6">
      {getPageIcon(url, 'h-6 w-6')}
      <span className="text-xs">{loading ? 'Loading preview…' : 'No preview yet'}</span>
    </span>
  );
}
