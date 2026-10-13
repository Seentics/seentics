import type { ReactNode } from 'react';

/** A browser window around a screenshot or a mock, so the visual reads as "a page". */
export function BrowserFrame({
  url, children, className = '',
}: { url?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)] ${className}`}>
      <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-3.5 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <i className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <i className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <i className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </span>
        {url && (
          <span className="flex-1 truncate rounded-md bg-background/70 px-3 py-1 text-center text-[11.5px] text-muted-foreground">{url}</span>
        )}
      </div>
      {children}
    </div>
  );
}
