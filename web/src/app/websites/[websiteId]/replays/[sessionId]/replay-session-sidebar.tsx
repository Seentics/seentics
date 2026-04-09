'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReplaySession } from '@/lib/replays-api';
import { displayRealtimePath } from '@/lib/realtime-path';
import { cn } from '@/lib/utils';
import {
  ReplaySessionTimelineLog,
  useReplayPlayback,
  type SessionReplayBridge,
} from './session-replay-surface';

function formatRecordingDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatStartedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function SummaryField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[9.5rem_1fr] sm:gap-x-4 sm:gap-y-0">
      <dt className="text-xs text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-xs font-medium text-foreground sm:text-sm">{children}</dd>
    </div>
  );
}

function SessionSummaryCard({
  session,
  websiteId = '',
}: {
  session: ReplaySession | null;
  websiteId?: string;
}) {
  const entryDisplay = session?.entryPage
    ? displayRealtimePath(session.entryPage, websiteId ?? '', 80)
    : '';

  return (
    <Card className="flex min-h-0 flex-col shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Session summary</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Who this was, where they started, and how long the recording runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!session ? (
          <p className="text-xs text-muted-foreground">No session metadata loaded.</p>
        ) : (
          <>
            <dl className="space-y-3">
              <SummaryField label="Browser">{session.browser}</SummaryField>
              <SummaryField label="Device / OS">
                {session.device}
                <span className="text-muted-foreground"> · </span>
                {session.os}
              </SummaryField>
              <SummaryField label="Country">{session.country}</SummaryField>
              <SummaryField label="Entry page">
                <span className="break-all font-mono text-[11px] sm:text-xs" title={session.entryPage || undefined}>
                  {entryDisplay || '—'}
                </span>
              </SummaryField>
              <SummaryField label="Started">{formatStartedAt(session.startedAt)}</SummaryField>
              <SummaryField label="Recording length">
                {formatRecordingDuration(session.durationSeconds)}
              </SummaryField>
              <SummaryField label="Pages viewed">{String(session.pagesViewed)}</SummaryField>
            </dl>
            {(session.hasErrors || session.hasRageClicks) && (
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                {session.hasErrors && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-red-500/50 text-red-800 dark:text-red-300 bg-red-500/10"
                  >
                    Client errors
                  </Badge>
                )}
                {session.hasRageClicks && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-500/50 text-amber-800 dark:text-amber-300 bg-amber-500/10"
                  >
                    Rage clicks
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineCard({ replayBridge }: { replayBridge: SessionReplayBridge | null }) {
  const { currentMs, playing } = useReplayPlayback();

  return (
    <Card className="flex min-w-0 flex-col shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Timeline</CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Jump to each distinct URL (repeated snapshots on the same page are folded). Rage clicks and
          errors appear when captured. Use the scrubber under the player for every full snapshot.
        </CardDescription>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden />
            Page
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            Rage
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" aria-hidden />
            Error
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {replayBridge ? (
          <ReplaySessionTimelineLog
            embedded
            entries={replayBridge.logEntries}
            currentMs={currentMs}
            durationMs={replayBridge.durationMs}
            playing={playing}
            player={replayBridge.player}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/10 px-4 py-12 text-center">
            <p className="text-xs font-medium text-muted-foreground">Preparing playback…</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReplaySessionSidebar({
  replayBridge = null,
  session = null,
  websiteId = '',
}: {
  replayBridge?: SessionReplayBridge | null;
  session?: ReplaySession | null;
  websiteId?: string;
}) {
  return (
    <section
      className={cn(
        'shrink-0 border-t border-border/80 bg-muted/20 px-3 py-5 sm:px-5',
        'backdrop-blur-sm',
      )}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 lg:items-start">
        <SessionSummaryCard session={session} websiteId={websiteId} />
        <TimelineCard replayBridge={replayBridge} />
      </div>
    </section>
  );
}
