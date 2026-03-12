'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useCustomEvents } from '@/lib/analytics-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Zap, ChevronDown, ChevronRight } from 'lucide-react';

export default function EventsExplorerPage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const { data, isLoading } = useCustomEvents(websiteId, days);

  const events = data?.top_events ?? [];
  const filtered = search
    ? events.filter((e: any) => e.event_type?.toLowerCase().includes(search.toLowerCase()))
    : events;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Event Explorer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drill into custom events with properties and filters
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                days === d ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground font-medium">Total Events</p>
            <p className="text-2xl font-bold tabular-nums">{isLoading ? '--' : (data?.total_events ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground font-medium">Unique Event Types</p>
            <p className="text-2xl font-bold tabular-nums">{isLoading ? '--' : (data?.unique_events ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground font-medium">Period</p>
            <p className="text-2xl font-bold">Last {days} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Events table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap size={15} className="text-muted-foreground" />
            Custom Events ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? 'No events matching your search' : 'No custom events tracked yet'}
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 py-2 text-xs font-medium text-muted-foreground">
                <div className="col-span-5">Event Name</div>
                <div className="col-span-2 text-right">Count</div>
                <div className="col-span-2 text-right">Unique Visitors</div>
                <div className="col-span-3 text-right">Properties</div>
              </div>
              {/* Rows */}
              {filtered.map((event: any) => {
                const isExpanded = expandedEvent === event.event_type;
                const props = event.sample_properties || event.common_properties || {};
                const propKeys = Object.keys(props);
                return (
                  <div key={event.event_type}>
                    <button
                      onClick={() => setExpandedEvent(isExpanded ? null : event.event_type)}
                      className="grid grid-cols-12 gap-2 py-3 w-full text-left hover:bg-muted/30 rounded transition-colors text-sm"
                    >
                      <div className="col-span-5 flex items-center gap-2">
                        {propKeys.length > 0 ? (
                          isExpanded ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                        ) : (
                          <div className="w-3.5" />
                        )}
                        <span className="font-medium text-foreground truncate">{event.event_type}</span>
                      </div>
                      <div className="col-span-2 text-right tabular-nums">{(event.count ?? 0).toLocaleString()}</div>
                      <div className="col-span-2 text-right tabular-nums text-muted-foreground">{event.unique_visitors ?? '-'}</div>
                      <div className="col-span-3 text-right text-muted-foreground">
                        {propKeys.length > 0 ? `${propKeys.length} keys` : '-'}
                      </div>
                    </button>
                    {isExpanded && propKeys.length > 0 && (
                      <div className="ml-8 mb-3 p-3 bg-muted/20 rounded-lg text-xs space-y-1.5">
                        <p className="font-medium text-muted-foreground mb-2">Sample Properties</p>
                        {propKeys.map((key) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-primary font-mono">{key}:</span>
                            <span className="text-foreground">{JSON.stringify(props[key])}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
