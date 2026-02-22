'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MousePointerClick, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@/lib/analytics-api';

interface FrustrationSignalsProps {
  customEvents?: any;
  websiteId: string;
  isLoading?: boolean;
}

export function FrustrationSignals({ customEvents, websiteId, isLoading }: FrustrationSignalsProps) {
  if (isLoading) {
    return (
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const topEvents = customEvents?.top_events || [];
  const rageClicks = topEvents.filter((e: any) =>
    e.event_type?.toLowerCase().includes('rage_click') ||
    e.event_type?.toLowerCase().includes('rage-click')
  );
  const deadClicks = topEvents.filter((e: any) =>
    e.event_type?.toLowerCase().includes('dead_click') ||
    e.event_type?.toLowerCase().includes('dead-click')
  );
  const errorEvents = topEvents.filter((e: any) =>
    e.event_type?.toLowerCase().includes('error') ||
    e.event_type?.toLowerCase().includes('exception')
  );

  const rageCount = rageClicks.reduce((sum: number, e: any) => sum + (e.count || 0), 0);
  const deadCount = deadClicks.reduce((sum: number, e: any) => sum + (e.count || 0), 0);
  const errorCount = errorEvents.reduce((sum: number, e: any) => sum + (e.count || 0), 0);
  const totalSignals = rageCount + deadCount + errorCount;

  const signals = [
    {
      label: 'Rage Clicks',
      count: rageCount,
      icon: MousePointerClick,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Dead Clicks',
      count: deadCount,
      icon: XCircle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'JS Errors',
      count: errorCount,
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold tracking-tight">Frustration Signals</CardTitle>
            <p className="text-xs text-muted-foreground">User friction indicators</p>
          </div>
          {totalSignals > 0 && (
            <div className="text-xs font-bold text-red-500 bg-red-500/10 px-2.5 py-1 rounded">
              {formatNumber(totalSignals)} total
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {totalSignals === 0 ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <MousePointerClick className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No frustration detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Frustration signals will appear here as your tracker collects interaction data.
              </p>
            </div>
            <Link
              href={`/websites/${websiteId}/recordings`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-2"
            >
              View Session Recordings
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.label} className="flex items-center justify-between py-2.5 px-3 rounded border border-border/40 hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${signal.bgColor}`}>
                      <Icon className={`h-4 w-4 ${signal.color}`} />
                    </div>
                    <span className="text-sm font-medium">{signal.label}</span>
                  </div>
                  <span className="text-sm font-bold">{formatNumber(signal.count)}</span>
                </div>
              );
            })}
            <Link
              href={`/websites/${websiteId}/recordings`}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline pt-2"
            >
              Investigate in Recordings
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
