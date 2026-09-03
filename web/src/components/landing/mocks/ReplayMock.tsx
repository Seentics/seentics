import { ArrowLeft, Copy, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DemoReplayPlayer } from '@/components/replays/DemoReplayStage';
import { MockSidebar } from './MockSidebar';

/**
 * A session replay, playing.
 *
 * Mirrors `app/websites/[websiteId]/replays/[sessionId]/` — the header row with the
 * mono session id, the 16:9 black player with its zinc-900 transport bar, and the
 * tabbed sidebar (Summary / Timeline / Errors / Console / Network) with the badge
 * counts the real tabs carry.
 *
 * The player itself comes from `components/replays/DemoReplayStage`, shared with
 * `/websites/demo/replays/[sessionId]` — that page has no rrweb stream either, and
 * the landing shot is supposed to be a picture of it.
 */

const TABS = [
  { label: 'Summary' },
  { label: 'Timeline' },
  { label: 'Errors', badge: '1', badgeCls: 'text-red-400' },
  { label: 'Console', badge: '2', badgeCls: 'text-amber-400' },
  { label: 'Network' },
];

const SUMMARY = [
  { label: 'Browser', value: 'Chrome' },
  { label: 'Device / OS', value: 'Desktop · macOS' },
  { label: 'Country', value: 'United States' },
  { label: 'Entry page', value: '/pricing', mono: true },
  { label: 'Exit page', value: '/checkout/success', mono: true },
  { label: 'Started', value: 'Today at 2:41 PM' },
];

export function ReplayMock() {
  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <MockSidebar active="Recording" />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="w-full shrink-0 border-b border-border">
          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1.5 px-5 py-2">
            <span className="flex h-8 shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Replays
            </span>
            <div className="h-4 w-px shrink-0 bg-border/50" />
            <Video className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-sm font-semibold text-foreground">
                sess_8f2c41ab9de07
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground">
                <Copy className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="flex-1" />
            <Badge
              variant="outline"
              className="shrink-0 border-red-500/50 bg-red-500/10 text-[10px] text-red-800 dark:text-red-300"
            >
              Client errors
            </Badge>
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-800 dark:text-amber-300"
            >
              Rage clicks
            </Badge>
          </div>
        </div>

        {/* Player */}
        <div className="w-full shrink-0 px-5 pt-4">
          {/* The player itself lives in `components/replays/DemoReplayStage`, shared
              with `/websites/demo/replays/[sessionId]` so the landing shot and the
              demo screen cannot drift apart. Full width: it was capped at 620px to
              leave room for the summary card, which put an empty margin down both
              sides of the one thing this section is about. */}
          <DemoReplayPlayer />
        </div>

        {/* Tabbed sidebar */}
        <section className="min-h-0 flex-1 border-t border-border bg-background/60">
          <div className="border-b border-border bg-background/80 px-5">
            <div className="flex w-full items-center gap-0">
              {TABS.map((t, i) => (
                <span
                  key={t.label}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium',
                    i === 0 ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
                  )}
                >
                  {t.label}
                  {t.badge && (
                    <span className={cn('text-[10px] font-semibold tabular-nums', t.badgeCls)}>{t.badge}</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="px-5 py-4">
            <Card className="rounded-lg shadow-sm">
              <CardHeader className="space-y-0.5 pb-4">
                <p className="text-sm font-semibold text-foreground">Session summary</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Who this was, where they started, and how long the recording runs.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <dl className="space-y-3">
                  {SUMMARY.map((f) => (
                    <div key={f.label} className="grid grid-cols-[9.5rem_1fr] gap-x-4">
                      <dt className="pt-0.5 text-xs text-muted-foreground">{f.label}</dt>
                      <dd
                        className={cn(
                          'min-w-0 text-sm font-medium text-foreground',
                          f.mono && 'font-mono text-xs',
                        )}
                      >
                        {f.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
