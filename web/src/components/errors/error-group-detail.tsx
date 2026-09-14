import { Check, EyeOff, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { errorTypeOf, relativeTime } from '@/features/errors/format';
import type { ErrorGroup, ErrorSample, ErrorStatus } from '@/features/errors/types';
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
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            {errorTypeOf(group.message)}
          </Badge>
          <Badge variant="secondary" className="text-[10px] capitalize">{group.status}</Badge>
          <span className="text-xs text-muted-foreground">
            {group.event_count.toLocaleString()} occurrences · first seen{' '}
            {relativeTime(group.first_seen, now)} · last {relativeTime(group.last_seen, now)}
          </span>
        </div>

        {/* Wrapped here, unlike the list row: this is the copy someone reads and pastes. */}
        <p className="mt-2 break-words font-medium text-foreground">{group.message}</p>
        {group.source_file && (
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {group.source_file}
            {group.line_no != null ? `:${group.line_no}` : ''}
          </p>
        )}

        {onSetStatus && (
          <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-2 space-y-2">
          {samples.map((s) => (
            <ErrorSampleCard
              key={s.id}
              sample={s}
              now={now}
              onWatchReplay={onWatchReplay}
            />
          ))}
        </div>
      )}
    </div>
  );
}
