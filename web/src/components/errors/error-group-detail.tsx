import { Check, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import type { ErrorGroup, ErrorSample, ErrorStatus } from '@/features/errors/types';
import { MessageLine } from './error-group-row';
import { ErrorSampleCard } from './error-sample-card';

export interface ErrorGroupDetailProps {
  group: ErrorGroup;
  samples: ErrorSample[];
  /** Omitted where the view is read-only: a recording, or a viewer without write access. */
  onSetStatus?: (status: ErrorStatus) => void;
  onWatchReplay?: (sessionId: string) => void;
  isUpdating?: boolean;
  now?: number;
  className?: string;
}

/**
 * One fault in full: header, status actions, and its recent occurrences.
 *
 * Takes the group and its samples rather than a fingerprint to fetch, so the same
 * component serves the live page, a demo route and a recording. The status buttons are
 * driven by an optional callback for the same reason — a scene that films this panel
 * should show the buttons without being able to mutate anything.
 */
export function ErrorGroupDetail({
  group, samples, onSetStatus, onWatchReplay, isUpdating, now, className,
}: ErrorGroupDetailProps) {
  return (
    <div className={className}>
      <div className="surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Wrapped here, unlike the list row: this is the copy someone reads and pastes. */}
            <p className="break-words text-base font-medium">
              <MessageLine message={group.message} />
            </p>
            {group.source_file && (
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {group.source_file}
                {group.line_no != null ? `:${group.line_no}` : ''}
              </p>
            )}
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
              group.status === 'unresolved' && 'bg-red-500/10 text-red-700 dark:text-red-300',
              group.status === 'resolved' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              group.status === 'ignored' && 'bg-muted text-muted-foreground',
            )}
          >
            {group.status}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-3">
          <div>
            <dt className="text-xs text-muted-foreground">Occurrences</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {group.event_count.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">First seen</dt>
            <dd className="mt-0.5 text-lg font-semibold text-foreground">
              {relativeTime(group.first_seen, now)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last seen</dt>
            <dd className="mt-0.5 text-lg font-semibold text-foreground">
              {relativeTime(group.last_seen, now)}
            </dd>
          </div>
        </dl>

        {onSetStatus && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            <Button
              size="sm" variant="outline" className="h-8 gap-1.5"
              disabled={isUpdating || group.status === 'resolved'}
              onClick={() => onSetStatus('resolved')}
            >
              <Check className="h-3.5 w-3.5" /> Resolve
            </Button>
            <Button
              size="sm" variant="outline" className="h-8 gap-1.5"
              disabled={isUpdating || group.status === 'ignored'}
              onClick={() => onSetStatus('ignored')}
            >
              <EyeOff className="h-3.5 w-3.5" /> Ignore
            </Button>
            {group.status !== 'unresolved' && (
              <Button
                size="sm" variant="ghost" className="h-8 gap-1.5"
                disabled={isUpdating}
                onClick={() => onSetStatus('unresolved')}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reopen
              </Button>
            )}
          </div>
        )}
      </div>

      <h3 className={cn('mt-5 text-sm font-semibold text-foreground')}>Recent occurrences</h3>
      {!samples.length ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No samples kept in this range — occurrences are retained for a shorter period
          than the counts above.
        </p>
      ) : (
        <div className="surface mt-2 divide-y divide-border overflow-hidden">
          {samples.map((s) => (
            <ErrorSampleCard
              key={s.id}
              sample={s}
              message={group.message}
              now={now}
              onWatchReplay={onWatchReplay}
            />
          ))}
        </div>
      )}
    </div>
  );
}
