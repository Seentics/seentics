'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Radio,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  ArrowRight,
  Loader2,
  Eye,
  Users,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface RecentActivityItem {
  page: string;
  country: string;
  device: string;
  browser: string;
  referrer: string;
  timestamp: string;
}

function getDeviceIcon(device: string) {
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return <Smartphone className="h-3.5 w-3.5" />;
  if (d.includes('tablet')) return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}

function getCountryFlag(country: string) {
  if (!country) return null;
  try {
    const code = country.length === 2 ? country : null;
    if (!code) return null;
    const codePoints = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return null;
  }
}

export default function RealtimePage() {
  if (!isEnterprise) return null;

  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [liveVisitors, setLiveVisitors] = useState<number>(0);
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchData = useCallback(async () => {
    if (!websiteId) return;
    try {
      const [liveRes, activityRes] = await Promise.all([
        api.get(`/analytics/live-visitors/${websiteId}`),
        api.get(`/analytics/recent-activity/${websiteId}?limit=50`),
      ]);
      setLiveVisitors(liveRes.data?.live_visitors || 0);
      const items = activityRes.data?.data || activityRes.data || [];
      setActivity(Array.isArray(items) ? items : []);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch {
      // silently fail on polling
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  // Initial fetch + poll every 15s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Seconds ticker
  useEffect(() => {
    const timer = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Derive stats from activity
  const activePages = new Map<string, number>();
  const activeCountries = new Map<string, number>();
  const activeDevices = new Map<string, number>();

  activity.forEach((item) => {
    activePages.set(item.page, (activePages.get(item.page) || 0) + 1);
    if (item.country) activeCountries.set(item.country, (activeCountries.get(item.country) || 0) + 1);
    if (item.device) activeDevices.set(item.device, (activeDevices.get(item.device) || 0) + 1);
  });

  const topPages = Array.from(activePages.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topCountries = Array.from(activeCountries.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const topDevices = Array.from(activeDevices.entries())
    .sort((a, b) => b[1] - a[1]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <DashboardPageHeader
          title="Real-time"
          description="Live analytics as visitors browse your website."
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </div>
          Updated {secondsAgo}s ago
        </div>
      </div>

      {/* Live Visitors Hero */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Radio className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Visitors right now</p>
            <p className="text-5xl font-black tracking-tight text-foreground">{liveVisitors}</p>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Pages */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-bold">Active Pages</h3>
            <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
              {topPages.length}
            </Badge>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {topPages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No activity</p>
            ) : (
              topPages.map(([page, count]) => (
                <div key={page} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-medium truncate flex-1">{page}</span>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">{count}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Top Countries */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-green-500" />
            <h3 className="text-sm font-bold">Countries</h3>
            <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
              {topCountries.length}
            </Badge>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {topCountries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
            ) : (
              topCountries.map(([country, count]) => (
                <div key={country} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <span>{getCountryFlag(country)}</span>
                    {country}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">{count}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Devices */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-orange-500" />
            <h3 className="text-sm font-bold">Devices</h3>
          </div>
          <div className="space-y-1.5">
            {topDevices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
            ) : (
              topDevices.map(([device, count]) => {
                const total = activity.length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={device} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        {getDeviceIcon(device)}
                        {device || 'Unknown'}
                      </span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Live Activity Feed */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Live Activity Feed</h3>
          <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
            Last {activity.length} events
          </Badge>
        </div>
        <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No recent activity</p>
          ) : (
            activity.slice(0, 30).map((item, idx) => (
              <div
                key={`${item.timestamp}-${idx}`}
                className={cn(
                  'flex items-center gap-3 py-2 px-3 rounded transition-all',
                  idx === 0 && 'bg-primary/5 border border-primary/10',
                  idx > 0 && 'hover:bg-muted/30'
                )}
              >
                <div className="shrink-0 text-muted-foreground">
                  {getDeviceIcon(item.device)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">{item.page}</span>
                    {item.referrer && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{item.referrer}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    {item.country && (
                      <span className="flex items-center gap-0.5">
                        {getCountryFlag(item.country)} {item.country}
                      </span>
                    )}
                    {item.browser && <span>{item.browser}</span>}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.timestamp ? formatDistanceToNow(new Date(item.timestamp + 'Z'), { addSuffix: true }) : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
