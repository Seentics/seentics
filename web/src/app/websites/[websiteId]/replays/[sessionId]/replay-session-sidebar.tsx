'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReplaySession } from '@/lib/replays-api';
import { displayRealtimePath } from '@/lib/realtime-path';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, MousePointerClick, ScanLine, Keyboard, LogOut, AlertTriangle } from 'lucide-react';
import {
  ReplaySessionTimelineLog,
  useReplayPlayback,
  type SessionReplayBridge,
  type SessionActivityStats,
  type SessionErrorDetail,
} from './session-replay-surface';

// ── helpers ──────────────────────────────────────────────────────────────────

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

function fmtOffsetClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) {
    return `${h}:${(m % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Session summary ───────────────────────────────────────────────────────────

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
  exitPage,
}: {
  session: ReplaySession | null;
  websiteId?: string;
  exitPage?: string | null;
}) {
  const entryDisplay = session?.entryPage
    ? displayRealtimePath(session.entryPage, websiteId ?? '', 80)
    : '';
  const exitDisplay = exitPage ? displayRealtimePath(exitPage, websiteId ?? '', 80) : null;

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
              {exitDisplay && exitDisplay !== entryDisplay && (
                <SummaryField label="Exit page">
                  <span className="break-all font-mono text-[11px] sm:text-xs" title={exitPage ?? undefined}>
                    {exitDisplay}
                  </span>
                </SummaryField>
              )}
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

// ── Activity stats strip ──────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 min-w-0">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-semibold tabular-nums text-foreground leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ActivityStatsStrip({ stats }: { stats: SessionActivityStats }) {
  const scrollLabel =
    stats.maxScrollPx > 0
      ? stats.maxScrollPx >= 1000
        ? `${(stats.maxScrollPx / 1000).toFixed(1)}k px`
        : `${stats.maxScrollPx} px`
      : '0 px';

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatPill icon={MousePointerClick} value={String(stats.totalClicks)} label="Clicks" />
      <StatPill icon={ScanLine} value={scrollLabel} label="Max scroll" />
      <StatPill icon={Keyboard} value={String(stats.inputInteractions)} label="Inputs" />
      <StatPill
        icon={LogOut}
        value={stats.exitPage ? displayRealtimePath(stats.exitPage, '', 18) : '—'}
        label="Exit page"
      />
    </div>
  );
}

// ── JS Errors panel ───────────────────────────────────────────────────────────

function ErrorRow({
  error,
  idx,
  durationMs,
  player,
}: {
  error: SessionErrorDetail;
  idx: number;
  durationMs: number;
  player: SessionReplayBridge['player'];
}) {
  const [expanded, setExpanded] = useState(false);
  const { playing, syncNow } = useReplayPlayback();

  const canSeek = error.offsetMs !== null && durationMs > 0;
  const timeLabel = error.offsetMs !== null ? fmtOffsetClock(error.offsetMs) : '—';
  const fileRef = error.filename
    ? `${error.filename.split('/').pop()}${error.lineno != null ? `:${error.lineno}` : ''}`
    : null;

  return (
    <li className="border-b border-border/50 last:border-b-0">
      <div className="flex w-full min-w-0 items-start gap-2 px-2.5 py-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              className="min-w-0 text-left text-[11px] font-mono font-medium text-foreground break-words hover:text-primary transition-colors"
              onClick={() => setExpanded(e => !e)}
              title={error.stack ? 'Click to expand stack trace' : undefined}
            >
              <span className="inline-flex items-center gap-1">
                {error.stack
                  ? expanded
                    ? <ChevronDown className="h-3 w-3 shrink-0" />
                    : <ChevronRight className="h-3 w-3 shrink-0" />
                  : null}
                {error.message}
              </span>
            </button>
            <button
              type="button"
              disabled={!canSeek}
              title={canSeek ? 'Jump to this error' : undefined}
              className={cn(
                'shrink-0 tabular-nums text-[10px] text-muted-foreground',
                canSeek && 'cursor-pointer hover:text-foreground transition-colors',
              )}
              onClick={() => {
                if (error.offsetMs === null) return;
                try {
                  player.goto(Math.min(durationMs, Math.max(0, error.offsetMs)), playing);
                } catch { /* ignore */ }
                requestAnimationFrame(() => syncNow());
              }}
            >
              {timeLabel}
            </button>
          </div>
          {fileRef && (
            <p className="text-[10px] text-muted-foreground font-mono">{fileRef}</p>
          )}
          {expanded && error.stack && (
            <pre className="mt-1.5 max-h-40 overflow-y-auto rounded bg-muted/40 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all">
              {error.stack}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}

function ErrorDetailsCard({
  errors,
  durationMs,
  player,
}: {
  errors: SessionErrorDetail[];
  durationMs: number;
  player: SessionReplayBridge['player'];
}) {
  if (errors.length === 0) return null;
  return (
    <Card className="shadow-sm col-span-full">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold text-foreground">JS Errors</CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] border-red-500/50 text-red-800 dark:text-red-300 bg-red-500/10"
          >
            {errors.length}
          </Badge>
        </div>
        <CardDescription className="text-xs leading-relaxed">
          JavaScript errors and unhandled rejections captured during the session.
          {errors.some(e => e.offsetMs !== null) && ' Click the timestamp to seek the player.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 px-0 pb-0">
        <ul className="divide-y-0 rounded-b-lg overflow-hidden">
          {errors.map((err, i) => (
            <ErrorRow key={i} error={err} idx={i} durationMs={durationMs} player={player} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Timeline card (with per-page time) ───────────────────────────────────────

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

// ── Root export ───────────────────────────────────────────────────────────────

export function ReplaySessionSidebar({
  replayBridge = null,
  session = null,
  websiteId = '',
}: {
  replayBridge?: SessionReplayBridge | null;
  session?: ReplaySession | null;
  websiteId?: string;
}) {
  const hasActivity = replayBridge !== null;
  const stats       = replayBridge?.activityStats ?? null;
  const errors      = replayBridge?.errorDetails ?? [];

  return (
    <section
      className={cn(
        'shrink-0 border-t border-border/80 bg-muted/20 px-3 py-5 sm:px-5',
        'backdrop-blur-sm',
      )}
    >
      <div className="mx-auto max-w-7xl space-y-4 lg:space-y-5">
        {/* Activity stats strip */}
        {hasActivity && stats && (
          <ActivityStatsStrip stats={stats} />
        )}

        {/* Summary + Timeline side-by-side */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5 lg:items-start">
          <SessionSummaryCard
            session={session}
            websiteId={websiteId}
            exitPage={stats?.exitPage ?? null}
          />
          <TimelineCard replayBridge={replayBridge} />
        </div>

        {/* JS Errors full-width card (only when errors exist) */}
        {errors.length > 0 && replayBridge && (
          <div className="grid grid-cols-1 gap-4">
            <ErrorDetailsCard
              errors={errors}
              durationMs={replayBridge.durationMs}
              player={replayBridge.player}
            />
          </div>
        )}
      </div>
    </section>
  );
}
