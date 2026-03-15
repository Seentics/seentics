'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useCustomEvents } from '@/lib/analytics-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Zap, ChevronDown, ChevronRight, Hash, Users, CalendarDays } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-header';

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  isLoading: boolean;
}) {
  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl", color)}>
            <Icon size={18} className="opacity-80" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums tracking-tight", isLoading && "animate-pulse")}>
              {isLoading ? '--' : (typeof value === 'number' ? value.toLocaleString() : value)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mini Bar ───────────────────────────────────────────────────────────────
function EventBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  return (
    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden w-20">
      <div
        className="h-full bg-primary/60 rounded-full transition-all duration-300"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function EventsExplorerPage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const { data, isLoading } = useCustomEvents(websiteId, days);

  // Filter out internal tracker events
  const internalEvents = useMemo(() => new Set(['pageview', 'page_view', 'page_exit', 'scroll_depth', 'click']), []);
  const events = useMemo(
    () => (data?.top_events ?? []).filter((e: any) => !internalEvents.has(e.event_type)),
    [data, internalEvents]
  );

  const filtered = useMemo(
    () => search
      ? events.filter((e: any) => e.event_type?.toLowerCase().includes(search.toLowerCase()))
      : events,
    [events, search]
  );

  const totalOccurrences = useMemo(
    () => events.reduce((sum: number, e: any) => sum + (e.count ?? 0), 0),
    [events]
  );

  const maxCount = useMemo(
    () => Math.max(...filtered.map((e: any) => e.count ?? 0), 1),
    [filtered]
  );

  return (
    <div className="p-6 md:p-8 lg:p-10 w-full max-w-[1400px] mx-auto">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

          {/* Header */}
          <DashboardPageHeader
            title="Event Explorer"
            description="Analyze custom events, their frequency, and properties."
          >
            <div className="flex items-center gap-1.5">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "h-10 px-4 text-xs font-bold rounded transition-colors border",
                    days === d
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card/50 text-muted-foreground border-border/40 hover:bg-card hover:text-foreground"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </DashboardPageHeader>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Occurrences"
              value={totalOccurrences}
              icon={Hash}
              color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Unique Event Types"
              value={events.length}
              icon={Zap}
              color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Period"
              value={`Last ${days} days`}
              icon={CalendarDays}
              color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              isLoading={isLoading}
            />
          </div>

          {/* Events Table */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                  <Zap size={15} className="text-muted-foreground" />
                  Custom Events ({filtered.length})
                </CardTitle>
                <div className="relative max-w-xs w-full">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 bg-background/50"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <Zap size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? 'No events matching your search' : 'No custom events tracked yet'}
                  </p>
                  {!search && (
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Events will appear here once your tracker sends custom events.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/40">
                    <div className="col-span-5">Event Name</div>
                    <div className="col-span-2 text-right">Count</div>
                    <div className="col-span-2 text-right">Visitors</div>
                    <div className="col-span-3 text-right">Properties</div>
                  </div>
                  {/* Table rows */}
                  <div className="divide-y divide-border/30">
                    {filtered.map((event: any) => {
                      const isExpanded = expandedEvent === event.event_type;
                      const props = event.sample_properties || event.common_properties || {};
                      const propKeys = Object.keys(props);
                      return (
                        <div key={event.event_type}>
                          <button
                            onClick={() => setExpandedEvent(isExpanded ? null : event.event_type)}
                            aria-expanded={isExpanded}
                            aria-controls={propKeys.length > 0 ? `event-details-${event.event_type}` : undefined}
                            className="grid grid-cols-12 gap-2 px-6 py-3.5 w-full text-left hover:bg-muted/20 transition-colors text-sm items-center"
                          >
                            <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                              {propKeys.length > 0 ? (
                                isExpanded
                                  ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                                  : <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                              ) : (
                                <div className="w-3.5 shrink-0" />
                              )}
                              <span className="font-semibold text-foreground truncate">{event.event_type}</span>
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-2">
                              <EventBar value={event.count ?? 0} max={maxCount} />
                              <span className="font-bold tabular-nums text-foreground">{(event.count ?? 0).toLocaleString()}</span>
                            </div>
                            <div className="col-span-2 text-right tabular-nums text-muted-foreground font-medium">
                              {event.unique_visitors?.toLocaleString() ?? '-'}
                            </div>
                            <div className="col-span-3 text-right">
                              {propKeys.length > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/50 text-[11px] font-medium text-muted-foreground">
                                  {propKeys.length} {propKeys.length === 1 ? 'key' : 'keys'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">--</span>
                              )}
                            </div>
                          </button>
                          {isExpanded && propKeys.length > 0 && (
                            <div id={`event-details-${event.event_type}`} className="mx-6 mb-4 p-4 bg-muted/10 border border-border/40 rounded-lg text-xs">
                              <p className="font-semibold text-muted-foreground mb-3 text-[11px] uppercase tracking-wider">
                                Sample Properties
                              </p>
                              <div className="grid gap-2">
                                {propKeys.map((key) => (
                                  <div key={key} className="flex items-start gap-3 font-mono">
                                    <span className="text-primary font-semibold shrink-0">{key}</span>
                                    <span className="text-muted-foreground/50">:</span>
                                    <span className="text-foreground break-all">{JSON.stringify(props[key])}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
    </div>
  );
}
