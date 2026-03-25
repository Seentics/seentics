'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTraces, useTrace, TraceListItem, Span } from '@/lib/observability-api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Network, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function durationColor(ms: number): string {
  if (ms < 100) return 'text-green-600';
  if (ms < 500) return 'text-yellow-600';
  return 'text-red-600';
}

function TraceRow({ trace, onClick }: { trace: TraceListItem; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-foreground">{trace.root_operation}</span>
          <span className="text-xs text-muted-foreground">{trace.root_service}</span>
          <Badge
            className={cn(
              'text-[10px] px-1.5 py-0 h-4 border-0 rounded',
              trace.status === 'error'
                ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
            )}
          >
            {trace.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{new Date(trace.start_time).toLocaleTimeString()}</span>
          <span>{trace.span_count} spans</span>
          <span className="font-mono text-[10px]">{trace.trace_id.slice(0, 16)}...</span>
        </div>
      </div>
      <span className={cn('text-sm font-bold font-mono', durationColor(trace.duration_ms))}>
        {trace.duration_ms}ms
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// Waterfall view for a single trace
function TraceWaterfall({ projectId, traceId, onClose }: { projectId: string; traceId: string; onClose: () => void }) {
  const { data, isLoading } = useTrace(projectId, traceId);
  const spans = data?.spans ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  if (spans.length === 0) return <div className="p-8 text-center text-muted-foreground text-sm">No spans found.</div>;

  // Calculate waterfall offsets relative to trace start
  const traceStart = Math.min(...spans.map(s => new Date(s.start_time).getTime()));
  const traceEnd   = Math.max(...spans.map(s => new Date(s.end_time).getTime()));
  const totalMs    = Math.max(traceEnd - traceStart, 1);

  return (
    <div>
      {spans.map((span, i) => {
        const spanStart  = new Date(span.start_time).getTime();
        const offsetPct  = ((spanStart - traceStart) / totalMs) * 100;
        const widthPct   = Math.max((span.duration_ms / totalMs) * 100, 0.5);
        const depth      = getDepth(span, spans);

        return (
          <div key={span.span_id} className="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 hover:bg-muted/10 group">
            <div className="w-48 shrink-0 flex items-center gap-1 min-w-0">
              <span style={{ paddingLeft: depth * 16 }} className="text-xs text-foreground truncate block">
                {span.operation}
              </span>
            </div>
            <div className="text-xs text-muted-foreground w-24 shrink-0">{span.service}</div>
            <div className="flex-1 relative h-5">
              <div
                className={cn(
                  'absolute top-0.5 h-4 rounded',
                  span.status === 'error' ? 'bg-red-400/70' : 'bg-primary/40',
                )}
                style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
              />
            </div>
            <span className={cn('text-xs font-mono w-16 text-right shrink-0', durationColor(span.duration_ms))}>
              {span.duration_ms}ms
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getDepth(span: Span, all: Span[]): number {
  let depth = 0;
  let current = span;
  while (current.parent_span_id) {
    const parent = all.find(s => s.span_id === current.parent_span_id);
    if (!parent) break;
    depth++;
    current = parent;
  }
  return depth;
}

export default function TracesPage() {
  const params = useParams();
  const projectId = params?.websiteId as string;

  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const { data, isLoading } = useTraces(projectId);
  const traces = data?.traces ?? [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        title="Distributed Tracing"
        description="OpenTelemetry-compatible span ingestion. Click a trace to view the waterfall."
        icon={Network}
      />

      <div className={cn('grid gap-6', selectedTraceId ? 'grid-cols-[1fr_1fr]' : 'grid-cols-1')}>
        {/* Trace list */}
        <Card className="border border-border/60">
          <CardContent className="p-0">
            {/* Column headers */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-border/60 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="flex-1">Operation / Service</span>
              <span className="w-16 text-right">Duration</span>
              <span className="w-4" />
            </div>

            {isLoading ? (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/40">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : traces.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No traces yet. Instrument your services with the SDK or send spans via the API.
              </div>
            ) : (
              traces.map(t => (
                <TraceRow
                  key={t.trace_id}
                  trace={t}
                  onClick={() => setSelectedTraceId(id => id === t.trace_id ? null : t.trace_id)}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Waterfall panel */}
        {selectedTraceId && (
          <Card className="border border-border/60">
            <CardHeader className="px-4 py-3 border-b border-border/60 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Trace Waterfall</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedTraceId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <TraceWaterfall
                projectId={projectId}
                traceId={selectedTraceId}
                onClose={() => setSelectedTraceId(null)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
