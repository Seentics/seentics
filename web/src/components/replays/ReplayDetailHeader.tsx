import { ArrowLeft, Copy, Link2, AlertTriangle, MousePointerClick, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ReplayDetailHeaderProps {
  sessionId: string;
  /** Signal badges. Absent while the session is still loading. */
  hasErrors?: boolean;
  hasRageClicks?: boolean;
  isDemo?: boolean;
  onBack: () => void;
  onCopyId: () => void;
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
  sessionId, hasErrors, hasRageClicks, isDemo, onBack, onCopyId, onCopyShareLink, className,
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

            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="min-w-0 text-xs font-semibold font-mono text-foreground truncate sm:text-sm"
                title={sessionId}
              >
                {sessionId}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                title="Copy session ID"
                onClick={onCopyId}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

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
              <Badge
                variant="outline"
                title="Set when a JavaScript error or unhandled promise rejection fired in the visitor’s browser while recording was on. Does not include console warnings or failed network requests."
                className="text-[10px] shrink-0 border-red-500/50 text-red-800 dark:text-red-300 bg-red-500/10"
              >
                Client errors
              </Badge>
            )}

            {hasRageClicks && (
              <Badge
                variant="outline"
                title="Set when we detect 3 or more clicks within about 1 second inside roughly 50×50 px in the recording—the same rule as the amber dots on the session timeline."
                className="text-[10px] shrink-0 border-amber-500/50 text-amber-800 dark:text-amber-300 bg-amber-500/10"
              >
                Rage clicks
              </Badge>
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
