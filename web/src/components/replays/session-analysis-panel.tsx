'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { askAbout } from '@/features/ai/ask-link';
import { useAiStatus } from '@/features/ai/queries';
import {
  FRUSTRATED_MIN_SCORE,
  OUTCOME_META,
  SIGNAL_META,
  TONE_CLASS,
  formatOffset,
  frustrationTone,
  getSessionAnalysis,
  markerPercent,
  signalChips,
  signalLine,
  summaryNotice,
  type FrustrationSignal,
} from '@/features/replays/analysis';
import { cn } from '@/lib/utils';
import { useReplayPlayback, type SessionReplayBridge } from '@/components/replays/session-replay-surface';

/**
 * "What happened here": the session's frustration score and moments, and — when AI is
 * configured — a short summary with its likely intent, outcome and moments to jump to.
 *
 * The signals are deterministic and always shown. The summary is asked for only when the
 * deployment has a model; without one this panel is the signals alone, and nothing about
 * it mentions AI. Every timestamp seeks the player.
 */
export function SessionAnalysisPanel({
  websiteId,
  sessionId,
  replayBridge,
}: {
  websiteId: string;
  sessionId: string;
  replayBridge: SessionReplayBridge | null;
}) {
  const aiStatus = useAiStatus();
  const aiConfigured = aiStatus.data?.configured === true;
  // Wait for the status so a configured deployment does not make two requests.
  const statusSettled = !aiStatus.isLoading;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['replay-analysis', websiteId, sessionId, aiConfigured],
    queryFn: () => getSessionAnalysis(websiteId, sessionId, aiConfigured),
    enabled: !!websiteId && !!sessionId && statusSettled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { playing, syncNow } = useReplayPlayback();
  const durationMs = replayBridge?.durationMs || data?.timeline?.durationMs || 0;
  const seek = (ms: number) => {
    if (!replayBridge) return;
    try {
      replayBridge.player.goto(Math.min(durationMs, Math.max(0, ms)), playing);
    } catch { /* stale player */ }
    requestAnimationFrame(() => syncNow());
  };
  const canSeek = !!replayBridge && durationMs > 0;

  const tone = frustrationTone(data?.score);
  const chips = signalChips(data?.counts);
  const notice = data ? summaryNotice(data.summaryStatus, data.retryAfterSec) : null;
  const struggled = !!data && (data.score >= FRUSTRATED_MIN_SCORE || chips.length > 0);

  return (
    <Card className="mb-3 flex min-h-0 flex-col rounded-lg shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="flex-1 text-sm font-semibold text-foreground">Session insight</CardTitle>
          {data?.status === 'ready' && (
            <span
              className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', TONE_CLASS[tone])}
              title="Frustration score, 0-100, from the signals found in this recording"
            >
              {data.score}/100
            </span>
          )}
          {aiConfigured && struggled && (
            <AskAiButton websiteId={websiteId} {...askAbout.session(sessionId)} />
          )}
        </div>
        <CardDescription className="text-xs leading-relaxed">
          Frustration found in the recording{aiConfigured ? ', and an AI summary of the visit' : ''}. Click a time to jump there.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {isLoading || !statusSettled ? (
          <div className="space-y-2" aria-busy="true">
            <p className="text-xs text-muted-foreground">
              {aiConfigured ? 'Analysing this session and writing a summary…' : 'Analysing this session…'}
            </p>
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : isError || !data ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Couldn&apos;t analyse this session.</p>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Retry
            </button>
          </div>
        ) : data.status === 'pending' ? (
          <p className="text-xs text-muted-foreground">
            This session is analysed once its recording has been uploaded. Check back in a minute.
          </p>
        ) : (
          <>
            {aiConfigured && (data.summary || notice) && (
              <section aria-label="AI summary" className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {data.summarySource === 'rules' ? 'Summary' : 'AI summary'}
                </div>
                {data.summary ? (
                  <>
                    <p className="text-[13px] leading-relaxed text-foreground">{data.summary.text}</p>
                    <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Intent</dt>
                      <dd className="text-foreground">{data.summary.intent}</dd>
                      <dt className="text-muted-foreground">Outcome</dt>
                      <dd>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', OUTCOME_META[data.summary.outcome].className)}>
                          {OUTCOME_META[data.summary.outcome].label}
                        </span>
                      </dd>
                    </dl>
                    {data.summary.moments.length > 0 && (
                      <ul className="space-y-1 pt-1">
                        {data.summary.moments.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <TimeButton atMs={m.atMs} canSeek={canSeek} onSeek={seek} />
                            <span className="text-foreground">{m.label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {data.summarySource === 'rules' && (
                      <p className="text-[11px] text-muted-foreground">
                        Written from the recorded signals: the AI summary isn&apos;t available right now.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{notice}</p>
                )}
              </section>
            )}

            <FrustrationTimeline
              signals={data.signals}
              durationMs={durationMs}
              canSeek={canSeek}
              onSeek={seek}
            />

            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span
                    key={c.type}
                    title={SIGNAL_META[c.type].description}
                    className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', SIGNAL_META[c.type].chip)}
                  >
                    {c.label}
                    <span className="tabular-nums opacity-80">{c.count}</span>
                  </span>
                ))}
              </div>
            )}

            {data.signals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No frustration signals found in this session.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {data.signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 px-2.5 py-1.5 text-xs">
                    <TimeButton atMs={s.atMs} canSeek={canSeek} onSeek={seek} />
                    <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', SIGNAL_META[s.type].dot)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{SIGNAL_META[s.type].label.replace(/s$/, '')}</p>
                      <p className="break-words text-[11px] text-muted-foreground">{signalLine(s)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TimeButton({ atMs, canSeek, onSeek }: { atMs: number; canSeek: boolean; onSeek: (ms: number) => void }) {
  return (
    <button
      type="button"
      disabled={!canSeek}
      onClick={() => onSeek(atMs)}
      title={canSeek ? 'Jump to this moment' : undefined}
      className={cn(
        'shrink-0 rounded px-1 font-mono text-[11px] tabular-nums text-primary',
        canSeek ? 'hover:bg-primary/10' : 'cursor-default text-muted-foreground',
      )}
    >
      {formatOffset(atMs)}
    </button>
  );
}

/** One bar the length of the recording, a dot per signal. */
function FrustrationTimeline({
  signals,
  durationMs,
  canSeek,
  onSeek,
}: {
  signals: FrustrationSignal[];
  durationMs: number;
  canSeek: boolean;
  onSeek: (ms: number) => void;
}) {
  if (!signals.length || !(durationMs > 0)) return null;
  return (
    <div className="space-y-1">
      <div className="relative h-3 w-full rounded-full bg-muted" role="list" aria-label="Frustration moments on the timeline">
        {signals.map((s, i) => (
          <button
            key={i}
            type="button"
            role="listitem"
            disabled={!canSeek}
            onClick={() => onSeek(s.atMs)}
            title={`${formatOffset(s.atMs)} · ${SIGNAL_META[s.type].label}${s.label ? ` · ${s.label}` : ''}`}
            aria-label={`${SIGNAL_META[s.type].label} at ${formatOffset(s.atMs)}`}
            className={cn(
              'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background',
              SIGNAL_META[s.type].dot,
              canSeek && 'hover:scale-125 transition-transform',
            )}
            style={{ left: `${markerPercent(s.atMs, durationMs)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>0:00</span>
        <span>{formatOffset(durationMs)}</span>
      </div>
    </div>
  );
}
