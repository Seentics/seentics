'use client';

import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReplaySession } from '@/lib/replays-api';
import { displayRealtimePath } from '@/lib/realtime-path';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  Bug,
  Minus,
} from 'lucide-react';
import {
  ReplaySessionTimelineLog,
  useReplayPlayback,
  type SessionReplayBridge,
  type SessionErrorDetail,
  type SessionConsoleDetail,
  type SessionNetworkDetail,
} from './session-replay-surface';
import { stripClientVersionLabel } from '@/components/replays/session-environment-visuals';

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
  /** When playback is ready, rrweb timeline length (matches transport); overrides stale DB `durationSeconds`. */
  playbackDurationSeconds,
}: {
  session: ReplaySession | null;
  websiteId?: string;
  exitPage?: string | null;
  playbackDurationSeconds?: number;
}) {
  const entryDisplay = session?.entryPage
    ? displayRealtimePath(session.entryPage, websiteId ?? '', 80)
    : '';
  const exitDisplay = exitPage ? displayRealtimePath(exitPage, websiteId ?? '', 80) : null;

  return (
    <Card className="flex min-h-0 flex-col shadow-sm rounded-xl">
      <CardHeader className="space-y-0.5 pb-4">
        <CardTitle className="text-sm font-semibold text-foreground">Session summary</CardTitle>
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
              <SummaryField label="Browser">{stripClientVersionLabel(session.browser || '') || '—'}</SummaryField>
              <SummaryField label="Device / OS">
                {session.device}
                <span className="text-muted-foreground"> · </span>
                {stripClientVersionLabel(session.os || '') || '—'}
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
                {formatRecordingDuration(
                  playbackDurationSeconds != null && playbackDurationSeconds >= 0
                    ? playbackDurationSeconds
                    : session.durationSeconds,
                )}
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
    <Card className="shadow-sm col-span-full rounded-xl">
      <CardHeader className="space-y-0.5 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold text-foreground">JS Errors</CardTitle>
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
    <Card className="flex min-w-0 flex-col shadow-sm rounded-xl">
      <CardHeader className="space-y-0.5 pb-4">
        <CardTitle className="text-sm font-semibold text-foreground">Timeline</CardTitle>
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

// ── Console / Network rows ────────────────────────────────────────────────────

const CONSOLE_LEVEL_STYLES: Record<SessionConsoleDetail['level'], { row: string; icon: React.ElementType; iconCls: string }> = {
  error: { row: 'bg-red-500/5 hover:bg-red-500/10',   icon: AlertTriangle, iconCls: 'text-red-400' },
  warn:  { row: 'hover:bg-muted/40',                   icon: AlertTriangle, iconCls: 'text-amber-400' },
  info:  { row: 'hover:bg-muted/40',                   icon: Info,          iconCls: 'text-sky-400' },
  debug: { row: 'hover:bg-muted/40',                   icon: Bug,           iconCls: 'text-violet-400' },
  log:   { row: 'hover:bg-muted/40',                   icon: Minus,         iconCls: 'text-muted-foreground/60' },
};

function ConsoleRow({
  entry,
  durationMs,
  player,
}: {
  entry: SessionConsoleDetail;
  durationMs: number;
  player: SessionReplayBridge['player'];
}) {
  const { playing, syncNow } = useReplayPlayback();
  const canSeek = entry.offsetMs !== null && durationMs > 0;
  const timeLabel = entry.offsetMs !== null ? fmtOffsetClock(entry.offsetMs) : '—';
  const styles = CONSOLE_LEVEL_STYLES[entry.level] ?? CONSOLE_LEVEL_STYLES.log;
  const IconEl = styles.icon;
  const message = entry.args.join(' ');

  return (
    <li className={cn('border-b border-border/40 last:border-b-0', styles.row)}>
      <div className="flex w-full min-w-0 items-start gap-2 px-2.5 py-1.5">
        <IconEl className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', styles.iconCls)} />
        <span className="min-w-0 flex-1 font-mono text-[11px] text-foreground break-words leading-relaxed">
          {message || <span className="text-muted-foreground/50 italic">empty</span>}
        </span>
        <button
          type="button"
          disabled={!canSeek}
          title={canSeek ? 'Jump to this moment' : undefined}
          className={cn(
            'shrink-0 tabular-nums text-[10px] text-muted-foreground',
            canSeek && 'cursor-pointer hover:text-foreground transition-colors',
          )}
          onClick={() => {
            if (entry.offsetMs === null) return;
            try { player.goto(Math.min(durationMs, Math.max(0, entry.offsetMs)), playing); } catch { /* ignore */ }
            requestAnimationFrame(() => syncNow());
          }}
        >
          {timeLabel}
        </button>
      </div>
    </li>
  );
}

function statusColor(status: number): string {
  if (status === 0)            return 'text-muted-foreground/60';
  if (status < 300)            return 'text-emerald-500 dark:text-emerald-400';
  if (status < 400)            return 'text-sky-500 dark:text-sky-400';
  if (status < 500)            return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function methodBadgeColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'POST':   return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'PUT':
    case 'PATCH':  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'DELETE': return 'bg-red-500/10 text-red-700 dark:text-red-300';
    default:       return 'bg-muted text-muted-foreground';
  }
}

function NetworkRow({
  entry,
  durationMs,
  player,
}: {
  entry: SessionNetworkDetail;
  durationMs: number;
  player: SessionReplayBridge['player'];
}) {
  const { playing, syncNow } = useReplayPlayback();
  const [expanded, setExpanded] = useState(false);
  const canSeek = entry.offsetMs !== null && durationMs > 0;
  const timeLabel = entry.offsetMs !== null ? fmtOffsetClock(entry.offsetMs) : '—';
  const hasError = !!entry.error;
  const shortUrl = (() => {
    try { return new URL(entry.url).pathname + new URL(entry.url).search; }
    catch { return entry.url; }
  })();

  return (
    <li className={cn('border-b border-border/40 last:border-b-0', hasError ? 'bg-red-500/5' : 'hover:bg-muted/40')}>
      <div className="flex w-full min-w-0 items-center gap-2 px-2.5 py-1.5">
        <span className={cn('shrink-0 rounded px-1 py-px text-[10px] font-semibold uppercase leading-none tabular-nums', methodBadgeColor(entry.method))}>
          {entry.method}
        </span>
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setExpanded(e => !e)}
          title={entry.url}
        >
          <span className="block truncate font-mono text-[11px] text-foreground">{shortUrl}</span>
        </button>
        <span className={cn('shrink-0 tabular-nums text-[11px] font-semibold', statusColor(entry.status))}>
          {entry.status === 0 ? 'ERR' : entry.status}
        </span>
        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/70 w-10 text-right">
          {entry.duration < 1000 ? `${entry.duration}ms` : `${(entry.duration / 1000).toFixed(1)}s`}
        </span>
        <button
          type="button"
          disabled={!canSeek}
          title={canSeek ? 'Jump to this moment' : undefined}
          className={cn(
            'shrink-0 tabular-nums text-[10px] text-muted-foreground w-10 text-right',
            canSeek && 'cursor-pointer hover:text-foreground transition-colors',
          )}
          onClick={() => {
            if (entry.offsetMs === null) return;
            try { player.goto(Math.min(durationMs, Math.max(0, entry.offsetMs)), playing); } catch { /* ignore */ }
            requestAnimationFrame(() => syncNow());
          }}
        >
          {timeLabel}
        </button>
      </div>
      {expanded && (
        <div className="px-2.5 pb-2 font-mono text-[10px] text-muted-foreground space-y-0.5">
          <div className="break-all">{entry.url}</div>
          {entry.error && <div className="text-red-400 break-all">{entry.error}</div>}
        </div>
      )}
    </li>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

type SidebarTab = 'summary' | 'timeline' | 'errors' | 'console' | 'network';

export function ReplaySessionSidebar({
  replayBridge = null,
  session = null,
  websiteId = '',
}: {
  replayBridge?: SessionReplayBridge | null;
  session?: ReplaySession | null;
  websiteId?: string;
}) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('summary');

  const stats          = replayBridge?.activityStats ?? null;
  const errors         = replayBridge?.errorDetails ?? [];
  const consoleDetails = replayBridge?.consoleDetails ?? [];
  const networkDetails = replayBridge?.networkDetails ?? [];

  const errorCount   = consoleDetails.filter(e => e.level === 'error').length;
  const warnCount    = consoleDetails.filter(e => e.level === 'warn').length;
  const netFailCount = networkDetails.filter(e => e.status >= 400 || e.status === 0).length;

  const tabs: { id: SidebarTab; label: string; badge?: number; badgeStyle?: string }[] = [
    { id: 'summary',  label: 'Summary' },
    { id: 'timeline', label: 'Timeline' },
    {
      id: 'errors',
      label: 'Errors',
      badge: errors.length || undefined,
      badgeStyle: errors.length ? 'text-red-400' : undefined,
    },
    {
      id: 'console',
      label: 'Console',
      badge: errorCount > 0 ? errorCount : warnCount > 0 ? warnCount : undefined,
      badgeStyle: errorCount > 0 ? 'text-red-400' : 'text-amber-400',
    },
    {
      id: 'network',
      label: 'Network',
      badge: netFailCount || undefined,
      badgeStyle: 'text-red-400',
    },
  ];

  return (
    <section className="shrink-0 border-t border-border/60 bg-background/60">
      {/* Tab bar */}
      <div className="border-b border-border/60 bg-background/80 px-3 sm:px-5">
        <div className="mx-auto" style={{ maxWidth: 'calc(68dvh * 16 / 9)' }}>
          <div className="flex items-center gap-0 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                {tab.label}
                {tab.badge != null && (
                  <span className={cn('tabular-nums text-[10px] font-semibold', tab.badgeStyle)}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab panels */}
      <div className="mx-auto px-3 py-5 sm:px-5" style={{ maxWidth: 'calc(68dvh * 16 / 9)' }}>
        {activeTab === 'summary' && (
          <SessionSummaryCard
            session={session}
            websiteId={websiteId}
            exitPage={stats?.exitPage ?? null}
            playbackDurationSeconds={
              replayBridge && replayBridge.durationMs > 0
                ? Math.round(replayBridge.durationMs / 1000)
                : undefined
            }
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineCard replayBridge={replayBridge} />
        )}

        {activeTab === 'errors' && (
          errors.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No JavaScript errors captured during this session.</p>
          ) : replayBridge ? (
            <ErrorDetailsCard
              errors={errors}
              durationMs={replayBridge.durationMs}
              player={replayBridge.player}
            />
          ) : null
        )}

        {activeTab === 'console' && replayBridge && (
          consoleDetails.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No console events captured. Sessions recorded before console capture was enabled will not have this data.
            </p>
          ) : (
            <Card className="shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-0">
                <ul className="max-h-96 overflow-y-auto overscroll-contain divide-y-0">
                  {consoleDetails.map((entry, i) => (
                    <ConsoleRow key={i} entry={entry} durationMs={replayBridge.durationMs} player={replayBridge.player} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        )}

        {activeTab === 'network' && replayBridge && (
          networkDetails.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No network events captured. Sessions recorded before network capture was enabled will not have this data.
            </p>
          ) : (
            <Card className="shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-2.5 py-1.5 border-b border-border/40 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                  <span className="w-10 shrink-0">Method</span>
                  <span className="flex-1 min-w-0">URL</span>
                  <span className="w-8 text-right shrink-0">Status</span>
                  <span className="w-10 text-right shrink-0">Time</span>
                  <span className="w-10 text-right shrink-0">At</span>
                </div>
                <ul className="max-h-96 overflow-y-auto overscroll-contain">
                  {networkDetails.map((entry, i) => (
                    <NetworkRow key={i} entry={entry} durationMs={replayBridge.durationMs} player={replayBridge.player} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </section>
  );
}
