'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MousePointer, Move, Eye, Percent, Flame } from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoHeatmapPages, demoHeatmapPoints } from '@/lib/demo/heatmaps';
import { cn } from '@/lib/utils';
import { StatCards } from '@/components/seentics-ui/StatCards';

type HeatType = 'click' | 'move';

function HeatmapCanvas({ points, width = 800, height = 440 }: {
  points: Array<{ x: number; y: number; intensity: number }>;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxX = Math.max(...points.map(p => p.x), 1);
    const maxY = Math.max(...points.map(p => p.y), 1);
    points.forEach(({ x, y, intensity }) => {
      const cx = (x / maxX) * canvas.width;
      const cy = (y / maxY) * canvas.height;
      const r = Math.max(20, intensity * 3);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(255, 80, 0, ${Math.min(intensity / 20, 0.6)})`);
      grad.addColorStop(0.5, `rgba(255, 165, 0, ${Math.min(intensity / 40, 0.3)})`);
      grad.addColorStop(1, 'rgba(255, 200, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
  }, [points]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full rounded-lg pointer-events-none"
    />
  );
}

export default function HeatmapDetailPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const slug = params?.slug as string;
  const isDemoMode = isDemo(websiteId);

  const [heatType, setHeatType] = useState<HeatType>('click');

  const pages = isDemoMode ? demoHeatmapPages() : [];
  const url = slug ? decodeURIComponent(slug).replace(/_/g, '/') : '/';
  // Find the page - the slug is the URL with slashes replaced by underscores
  // Try exact match first, then try with leading slash
  const page = pages.find(p => p.url === url) ||
               pages.find(p => p.url.replace(/\//g, '_') === slug) ||
               pages[0];

  const points = isDemoMode ? demoHeatmapPoints(heatType) : [];

  if (!page) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Page not found.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/heatmaps`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Heatmaps
        </Button>
      </div>

      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Flame className="h-5 w-5 text-orange-500" />
          <div>
            <h1 className="text-xl font-bold text-foreground font-mono">{page.url}</h1>
            <p className="text-xs text-muted-foreground">{heatType === 'click' ? 'Click' : 'Move'} heatmap · {points.length} data points</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['click', 'move'] as HeatType[]).map(t => (
            <Button
              key={t}
              variant={heatType === t ? 'default' : 'outline'}
              size="sm"
              className="h-8 capitalize"
              onClick={() => setHeatType(t)}
            >
              {t === 'click' ? <MousePointer className="h-3.5 w-3.5 mr-1.5" /> : <Move className="h-3.5 w-3.5 mr-1.5" />}
              {t}
            </Button>
          ))}
          {isDemoMode && <Badge variant="outline" className="text-[10px]">Demo Data</Badge>}
        </div>
      </div>

      {/* Stats */}
      <StatCards
        cards={[
          { label: 'Page Views', value: page.views, icon: Eye, iconColor: 'text-blue-600' },
          { label: 'Clicks',     value: page.clicks, icon: MousePointer, iconColor: 'text-primary' },
          { label: 'Avg Scroll', value: `${page.avg_scroll}%`, icon: Move, iconColor: 'text-indigo-600' },
          { label: 'Click Rate', value: `${((page.clicks / page.views) * 100).toFixed(1)}%`, icon: Percent, iconColor: 'text-green-600' },
        ]}
      />

      {/* Heatmap canvas */}
      <Card className="border border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold font-mono">{page.url}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="relative rounded-lg overflow-hidden bg-muted/10 border border-border/40" style={{ height: 480 }}>
            {/* Wireframe */}
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
            <HeatmapCanvas points={points} width={1000} height={480} />
          </div>
          {isDemoMode && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Demo data — install the tracker script to see real click patterns
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
