import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Lock,
  MousePointer,
  TrendingDown,
} from 'lucide-react';
import { DemoHeatmapPage } from '@/components/heatmaps/DemoHeatmapPage';
import { cn } from '@/lib/utils';
import { MockSidebar } from './MockSidebar';

/**
 * A click heatmap over a page.
 *
 * Mirrors `app/websites/[websiteId]/heatmaps/[slug]/page.tsx`: the header with the
 * point count and path, the Clicks/Scroll and device controls, the stage, and the
 * browser chrome the preview renders inside — traffic lights, inert back/forward, and
 * the mono URL bar with its lock.
 *
 * The page and its heat layer come from `components/heatmaps/DemoHeatmapPage`, shared
 * with the demo dashboard so this shot stays a picture of that screen.
 */

/** The preview's browser chrome — the real page renders the site inside one. */
function BrowserChrome() {
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800/90 bg-zinc-900 px-1.5">
      <div className="flex shrink-0 gap-1 px-0.5">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
      </div>
      <span className="shrink-0 rounded-lg p-1 text-zinc-600 opacity-60">
        <ChevronLeft className="h-3.5 w-3.5" />
      </span>
      <span className="shrink-0 rounded-lg p-1 text-zinc-600 opacity-60">
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-950/90 px-2 py-0.5">
        <Lock className="h-3 w-3 shrink-0 text-emerald-500/90" />
        <p className="min-w-0 truncate font-mono text-[11px] leading-snug text-zinc-400">
          <span className="text-zinc-500">acmestore.com</span>
          <span className="text-zinc-400">/pricing</span>
        </p>
      </div>
      <span className="shrink-0 rounded-lg p-1.5 text-zinc-400">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function SegmentedControl({
  items,
  active,
}: {
  items: Array<{ icon: typeof MousePointer; label: string }>;
  active: string;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-background p-0.5">
      {items.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className={cn(
            'flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs font-medium',
            label === active ? 'bg-muted text-foreground' : 'text-muted-foreground',
          )}
        >
          <Icon className="h-3 w-3 opacity-80" />
          {label}
        </span>
      ))}
    </div>
  );
}

export function HeatmapMock() {
  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <MockSidebar active="Heatmaps" />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border px-5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Heatmaps
            </span>

            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0 tabular-nums">12,481 pts</span>
              <span className="shrink-0 text-border">·</span>
              <code className="min-w-0 truncate font-mono text-[11px]">/pricing</code>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground">
                <Link2 className="h-3.5 w-3.5" />
              </span>
              <SegmentedControl
                items={[
                  { icon: MousePointer, label: 'Clicks' },
                  { icon: TrendingDown, label: 'Scroll' },
                ]}
                active="Clicks"
              />
              <span className="flex h-8 w-32 items-center rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground">
                Desktop
              </span>
              <SegmentedControl
                items={[
                  { icon: ImageIcon, label: 'Screenshot' },
                  { icon: MousePointer, label: 'Heat only' },
                ]}
                active="Screenshot"
              />
            </div>
          </div>
        </header>

        {/* Stage — darker than the page inside it, in whichever theme */}
        {/* Follows the theme, like the real stage now does. A hardcoded near-black
            here put a dark rectangle inside a light section. */}
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-muted p-5 dark:bg-[#09090b]">
          <div className="w-full max-w-[720px] overflow-hidden rounded-lg border border-zinc-800 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]">
            <BrowserChrome />
            <DemoHeatmapPage />
          </div>
        </div>
      </main>
    </div>
  );
}
