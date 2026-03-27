'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Play, Clock, Monitor, Smartphone, Tablet,
  AlertTriangle, Globe, MousePointer, Layers,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoReplaySession } from '@/lib/demo/replays';
import { cn } from '@/lib/utils';
import { StatCards } from '@/components/seentics-ui/StatCards';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d === 'mobile') return <Smartphone className="h-4 w-4" />;
  if (d === 'tablet') return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export default function ReplayDetailPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const sessionId = params?.sessionId as string;
  const isDemoMode = isDemo(websiteId);

  const session = isDemoMode ? demoReplaySession(sessionId) : null;

  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Session not found.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
        </Button>
      </div>
    );
  }

  const meta = [
    { label: 'Duration',    value: formatDuration(session.duration_seconds), icon: Clock },
    { label: 'Pages Viewed', value: session.pages_viewed, icon: Layers },
    { label: 'Events',       value: session.events_count, icon: MousePointer },
    { label: 'Country',      value: session.country, icon: Globe },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/replays`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Replays
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DeviceIcon device={session.device} />
            <h1 className="text-xl font-bold text-foreground">{session.country}</h1>
            <Badge variant="outline" className="text-xs">{session.browser}</Badge>
            <Badge variant="outline" className="text-xs">{session.os}</Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{session.session_id}</p>
        </div>
        <div className="flex items-center gap-2">
          {session.has_rage_clicks && (
            <Badge className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 border">
              <AlertTriangle className="h-3 w-3 mr-1" /> Rage Clicks
            </Badge>
          )}
          {session.has_errors && (
            <Badge className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 border">
              <AlertTriangle className="h-3 w-3 mr-1" /> Errors
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatCards
        cards={[
          { label: 'Duration',    value: formatDuration(session.duration_seconds), icon: Clock },
          { label: 'Pages Viewed', value: session.pages_viewed, icon: Layers },
          { label: 'Events',       value: session.events_count, icon: MousePointer },
          { label: 'Country',      value: session.country, icon: Globe },
        ]}
      />

      {/* Player */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border/60">
          <CardHeader className="px-5 py-4 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Session Player</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center gap-4 p-12 bg-muted/20 min-h-[320px]">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="h-7 w-7 text-primary fill-primary ml-0.5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {isDemoMode ? 'Demo Mode' : 'Loading replay...'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                  {isDemoMode
                    ? 'Install the Seentics tracker to record real sessions stored in your S3 bucket.'
                    : 'Connecting to replay storage...'}
                </p>
              </div>
            </div>
            {/* Timeline */}
            <div className="px-5 py-4 border-t border-border/40">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-0 bg-primary rounded-full" />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0:00</span>
                <span>{formatDuration(session.duration_seconds)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Info */}
        <Card className="border border-border/60">
          <CardHeader className="px-5 py-4 border-b border-border/40">
            <CardTitle className="text-sm font-semibold">Session Info</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {[
              { label: 'Entry',    value: session.entry_page },
              { label: 'Exit',     value: session.exit_page },
              { label: 'Browser',  value: session.browser },
              { label: 'OS',       value: session.os },
              { label: 'Device',   value: session.device },
              { label: 'Started',  value: new Date(session.start_time).toLocaleString() },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-5 py-3 border-b border-border/30 last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium text-foreground font-mono">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
