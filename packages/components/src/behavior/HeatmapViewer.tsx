import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flame, MousePointer, ArrowDownToLine, ChevronDown } from 'lucide-react';
import { useSeentics } from '../context';
import { Skeleton, Card, Empty, Tabs } from '../lib/ui';
import { fmt, t } from '../lib/utils';
import type { HeatmapPoint } from '../lib/types';

export interface HeatmapViewerProps {
  siteId:     string;
  className?: string;
  style?:     React.CSSProperties;
}

function drawHeatmap(canvas: HTMLCanvasElement, points: HeatmapPoint[], type: 'click' | 'scroll') {
  const ctx    = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  for (const pt of points) {
    const x   = (pt.x_percent / 100) * w;
    const y   = (pt.y_percent / 100) * h;
    const r   = type === 'click' ? 24 : 30;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = Math.min(0.7, 0.1 + pt.intensity * 0.1);
    grd.addColorStop(0,   type === 'click' ? `rgba(255,50,50,${alpha})` : `rgba(50,100,255,${alpha})`);
    grd.addColorStop(0.5, type === 'click' ? `rgba(255,150,0,${alpha * 0.5})` : `rgba(50,150,255,${alpha * 0.5})`);
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function HeatmapViewer({ siteId, className, style }: HeatmapViewerProps) {
  const { client } = useSeentics();
  const [type, setType]   = useState<'click' | 'scroll'>('click');
  const [page, setPage]   = useState<string | null>(null);
  const [open, setOpen]   = useState(false);
  const canvasRef         = useRef<HTMLCanvasElement>(null);

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['snc-heatmap-pages', siteId],
    queryFn:  () => client.getHeatmapPages(siteId),
    enabled:  !!siteId,
    onSuccess: (d: any) => { if (!page && d.pages?.[0]) setPage(d.pages[0].page_path); },
  } as any);

  const pages = (pagesData as any)?.pages ?? [];

  const { data: hmData, isLoading: hmLoading } = useQuery({
    queryKey: ['snc-heatmap', siteId, page, type],
    queryFn:  () => client.getHeatmapData(siteId, page!, type),
    enabled:  !!siteId && !!page,
  });

  // Draw on canvas whenever data changes
  useEffect(() => {
    if (!canvasRef.current || !hmData?.points?.length) return;
    drawHeatmap(canvasRef.current, hmData.points, type);
  }, [hmData, type]);

  const isLoading = pagesLoading || hmLoading;

  return (
    <Card className={className} style={style}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame size={15} color={t.muted} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Heatmap</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Type toggle */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: 2 }}>
            {(['click', 'scroll'] as const).map(tp => (
              <button key={tp} onClick={() => setType(tp)} style={{
                padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                background: type === tp ? '#fff' : 'transparent',
                color: type === tp ? '#111827' : t.muted,
                boxShadow: type === tp ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {tp === 'click' ? <MousePointer size={11} /> : <ArrowDownToLine size={11} />}
                {tp.charAt(0).toUpperCase() + tp.slice(1)}
              </button>
            ))}
          </div>

          {/* Page picker */}
          {pages.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                background: 'rgba(0,0,0,0.04)', border: `1px solid ${t.border}`,
                borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#111827', maxWidth: 160,
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page ?? 'Select page'}</span>
                <ChevronDown size={11} style={{ flexShrink: 0 }} />
              </button>
              {open && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff',
                  border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  zIndex: 10, minWidth: 200, maxHeight: 200, overflowY: 'auto',
                }}>
                  {pages.map((p: any) => (
                    <button key={p.page_path} onClick={() => { setPage(p.page_path); setOpen(false); }} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      width: '100%', textAlign: 'left', padding: '8px 14px', background: p.page_path === page ? `${t.primary}10` : 'transparent',
                      border: 'none', cursor: 'pointer', fontSize: 11, color: '#111827', gap: 8,
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.page_path}</span>
                      <span style={{ color: t.muted, flexShrink: 0 }}>{fmt.number(p.click_count)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', background: '#f8f8f8', minHeight: 300 }}>
        {isLoading
          ? <Skeleton style={{ height: 300, borderRadius: 0 }} />
          : !page || !hmData?.points?.length
            ? <Empty icon={<Flame size={32} />} message="No heatmap data" sub={page ? 'No interactions recorded for this page yet' : 'Select a page to view its heatmap'} />
            : (
              <canvas
                ref={canvasRef}
                width={800}
                height={400}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            )
        }
      </div>

      {/* Legend */}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 11, color: t.muted }}>Intensity:</span>
        <div style={{
          height: 8, flex: 1, maxWidth: 120, borderRadius: 4,
          background: type === 'click'
            ? 'linear-gradient(to right, rgba(50,100,255,0.1), rgba(255,150,0,0.5), rgba(255,50,50,0.8))'
            : 'linear-gradient(to right, rgba(50,100,255,0.1), rgba(50,150,255,0.5), rgba(50,50,255,0.8))',
        }} />
        <span style={{ fontSize: 11, color: t.muted }}>Low → High</span>
      </div>
    </Card>
  );
}
