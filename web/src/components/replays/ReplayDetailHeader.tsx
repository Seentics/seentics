import { ArrowLeft, Link2, AlertTriangle, MousePointerClick, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SessionClientRowStack, SessionCountryVisual } from '@/components/replays/session-environment-visuals';
import { formatDuration } from '@/features/replays/format';
import { cn } from '@/lib/utils';

export interface ReplayDetailHeaderProps {
  sessionId: string;
  /** Who the visitor was. Absent while the session is still loading. */
  context?: {
    country: string;
    browser: string;
    os: string;
    device: string;
    durationSeconds: number;
  };
  /** Signal badges. Absent while the session is still loading. */
  hasErrors?: boolean;
  hasRageClicks?: boolean;
  isDemo?: boolean;
  onBack: () => void;
  onCopyShareLink: () => void;
  className?: string;
}

/**
 * The bar above the replay: back, session id, copy actions and signal badges.
 *
 * Takes the session's flags and three callbacks rather than the session object, so it
 * renders the same from a live query, a fixture, or a shared-link view that has no
 * navigation to offer.
 */
export function ReplayDetailHeader({
  sessionId, context, hasErrors, hasRageClicks, isDemo, onBack, onCopyShareLink, className,
}: ReplayDetailHeaderProps) {
  return (
      <div className="w-full shrink-0 border-b border-border backdrop-blur-md">
        <div className="w-full px-3 py-2 md:px-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0 -ml-2"
              onClick={() => onBack()}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Replays
            </Button>

            <div className="hidden h-4 w-px bg-border/50 sm:block shrink-0" />

            <Video className="h-3.5 w-3.5 text-primary shrink-0 hidden sm:block" />

            <span
              className="min-w-0 truncate font-mono text-xs text-muted-foreground"
              title={sessionId}
            >
              {sessionId}
            </span>

            {/* The visitor, so the page says who this is before anything is played. */}
            {context && (
              <>
                <div className="hidden h-4 w-px bg-border/50 lg:block shrink-0" />
                <div className="hidden min-w-0 items-center gap-3 lg:flex">
                  <SessionCountryVisual country={context.country} />
                  <SessionClientRowStack browser={context.browser} os={context.os} device={context.device} />
                  {context.durationSeconds > 0 && (
                    <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
                      {formatDuration(context.durationSeconds)}
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="min-w-2 flex-1 basis-2 sm:basis-auto" />

            {!isDemo && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Copy link to this replay"
                onClick={onCopyShareLink}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            )}

            {hasErrors && (
              <span
                title="Set when a JavaScript error or unhandled promise rejection fired in the visitor’s browser while recording was on. Does not include console warnings or failed network requests."
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Errors
              </span>
            )}

            {hasRageClicks && (
              <span
                title="Set when we detect 3 or more clicks within about 1 second inside roughly 50×50 px in the recording—the same rule as the amber dots on the session timeline."
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                Rage clicks
              </span>
            )}

            {isDemo && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                Demo
              </Badge>
            )}
          </div>
        </div>
      </div>
  );
}
