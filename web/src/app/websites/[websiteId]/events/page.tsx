'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useCustomEvents } from '@/lib/analytics-api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Activity, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCards } from '@/components/seentics-ui/StatCards';

function EventRow({ event }: { event: any }) {
  const [open, setOpen] = useState(false);
  const hasProps = event.top_properties && Object.keys(event.top_properties).length > 0;

  return (
    <div className="border-b border-border last:border-0">
      <div
        className={cn('flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors', hasProps && 'cursor-pointer')}
        onClick={() => hasProps && setOpen(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{event.event_type}</span>
            {hasProps && (
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
            )}
          </div>
        </div>
        <span className="text-sm font-semibold w-24 text-right shrink-0">{(event.count || 0).toLocaleString()}</span>
        <span className="text-xs text-muted-foreground w-28 text-right shrink-0">{(event.unique_users || 0).toLocaleString()} users</span>
      </div>

      {open && hasProps && (
        <div className="px-5 pb-4 bg-muted/10">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Property breakdown</p>
          <div className="space-y-1">
            {Object.entries(event.top_properties).slice(0, 10).map(([key, vals]: any) => (
              <div key={key} className="text-xs">
                <span className="font-mono font-semibold text-primary">{key}</span>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {Object.entries(vals || {}).slice(0, 8).map(([val, count]: any) => (
                    <Badge key={val} variant="secondary" className="text-[10px] px-2 py-0">
                      {val}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [dateRange, setDateRange] = useState(7);

  const { data, isLoading } = useCustomEvents(websiteId, dateRange);
  const events: any[] = data?.top_events ?? [];

  // Filter out internal seentics events
  const internalEvents = new Set(['pageview', 'session_start', 'session_end', '__sn_heartbeat', '__sn_leave']);
  const filteredEvents = events.filter(e => !internalEvents.has(e.event_type));

  const totalEvents = filteredEvents.reduce((s, e) => s + (e.count || 0), 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Custom Events"
        description="All custom events tracked via seentics.track(). Click a row to see property breakdowns."
      >
        <Select value={String(dateRange)} onValueChange={v => setDateRange(Number(v))}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[7, 14, 30, 90].map(d => (
              <SelectItem key={d} value={String(d)} className="text-xs">Last {d} days</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DashboardPageHeader>

      {/* Summary */}
      {!isLoading && filteredEvents.length > 0 && (
        <StatCards
          cards={[
            { label: 'Event Types', value: filteredEvents.length, icon: Layers, tone: 'accent' },
            { label: 'Total Occurrences', value: totalEvents, icon: Activity, tone: 'info' },
          ]}
          cols={2}
        />
      )}

      {/* Events table */}
      <div className="mb-4 mt-8">
        <h3 className="text-sm font-semibold text-foreground">Custom Events</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{filteredEvents.length} event type{filteredEvents.length !== 1 ? 's' : ''} tracked</p>
      </div>
      <Card className="border border-border">
        <CardContent className="p-0">
          <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/20 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex-1">Event</span>
            <span className="w-24 text-right">Count</span>
            <span className="w-28 text-right">Unique users</span>
          </div>

          {isLoading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No custom events tracked yet. Call{' '}
              <code className="font-mono bg-muted px-1 rounded-lg">seentics.track('event_name')</code>{' '}
              from your site to start tracking.
            </div>
          ) : (
            filteredEvents
              .sort((a, b) => (b.count || 0) - (a.count || 0))
              .map((event, i) => <EventRow key={event.event_type ?? i} event={event} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
