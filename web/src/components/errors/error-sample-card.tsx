import { Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import type { ErrorSample } from '@/features/errors/types';

export interface ErrorSampleCardProps {
  sample: ErrorSample;
  /** The group's message. A stack that opens with it has that line trimmed: it is already on screen. */
  message?: string;
  /** Omitted when there is nowhere to send the viewer — a recording, or a public demo. */
  onWatchReplay?: (sessionId: string) => void;
  now?: number;
  className?: string;
}

/**
 * One occurrence: when, where, on what, and the stack.
 *
 * The replay button is the reason this feature is worth building in-product rather than
 * buying, so it is the thing this component is arranged around. It is absent for a
 * sample with no `session_id`, which is the honest state for a visitor who was sampled
 * out of recording — an empty button implying a replay that does not exist would be
 * worse than saying so.
 */
export function ErrorSampleCard({ sample, message, onWatchReplay, now, className }: ErrorSampleCardProps) {
  const stack = message && sample.stack?.startsWith(message)
    ? sample.stack.slice(message.length).replace(/^\s*\n/, '').replace(/^ {1,8}at /gm, 'at ')
    : sample.stack;

  return (
    <div className={cn('p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">
          {relativeTime(sample.occurred_at, now)} · {sample.page_path || '—'}
          {sample.browser ? ` · ${sample.browser}` : ''}
          {sample.device_type ? ` · ${sample.device_type}` : ''}
        </span>
        {sample.session_id && onWatchReplay ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 hover:text-primary"
            onClick={() => onWatchReplay(sample.session_id!)}
          >
            <Video className="h-3.5 w-3.5" /> Watch replay
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No replay recorded</span>
        )}
      </div>
      {stack && (
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {stack}
        </pre>
      )}
    </div>
  );
}
