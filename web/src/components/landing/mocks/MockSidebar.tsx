'use client';

import {
  Banknote,
  Send,
  Bot,
  Bug,
  Code2,
  Contact,
  Flame,
  GitBranch,
  LayoutDashboard,
  PanelLeftClose,
  Plug,
  Settings,
  Sparkles,
  Video,
} from 'lucide-react';
import { createContext, useContext } from 'react';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

/**
 * The dashboard sidebar, frozen.
 *
 * A copy rather than an import of `components/dashboard/Sidebar`: the real one reads
 * `usePathname`, `useAuth` and localStorage, renders `<Link>`s and opens a popover —
 * none of which belong on a marketing page. The chrome is reproduced class-for-class
 * (widths, heights, type sizes, the active tint) so the mock is the sidebar people see
 * after signing up, not an impression of it.
 */

const NAV = [
  // The real sidebar's order (components/dashboard/Sidebar.tsx).
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Recording', icon: Video },
  { label: 'Heatmaps', icon: Flame },
  { label: 'Funnels', icon: GitBranch },
  { label: 'Automations', icon: Bot },
  { label: 'Leads', icon: Contact },
  { label: 'Revenue', icon: Banknote },
  { label: 'Conversions', icon: Send },
  { label: 'Integrations', icon: Plug },
  { label: 'AI Reports', icon: Sparkles },
  { label: 'Errors', icon: Bug },
  { label: 'Developers', icon: Code2 },
  { label: 'Settings', icon: Settings },
] as const;

export type MockNavLabel = (typeof NAV)[number]['label'];

const DEFAULT_ORDER: readonly MockNavLabel[] = NAV.map((item) => item.label);

/**
 * Set by the landing hero to make the mock explorable: the sidebar items it has a screen
 * for become buttons that switch to it. Everywhere else (no provider) the mock stays a
 * still picture.
 */
export const MockNavContext = createContext<{
  views: readonly MockNavLabel[];
  onSelect: (label: MockNavLabel) => void;
  /** The sidebar's items in this order (a website type's, features/sidebar/profiles.ts); the usual list without it. */
  order?: readonly MockNavLabel[];
} | null>(null);

/**
 * Props for a mock's content area. In the explorable hero only the sidebar takes input:
 * the screen beside it is a picture, so it is inert — not focusable, not clickable — and
 * keyboard users are not walked through dozens of controls that do nothing.
 */
/** Whether this mock is inside the hero's explorer (screens there share one scale and fill it). */
export function useInMockExplorer(): boolean {
  return useContext(MockNavContext) !== null;
}

export function useMockContentProps(): { inert?: boolean } {
  return useContext(MockNavContext) ? { inert: true } : {};
}

/**
 * The page beside the sidebar, as the dashboard draws it from md up (app/websites/[websiteId]/layout.tsx):
 * edge to edge, the page's grey against the sidebar in the cards' colour, no line between.
 */
export const MOCK_FRAME = 'overflow-hidden app-frame';

export function MockSidebar({ active = 'Overview' }: { active?: MockNavLabel }) {
  const nav = useContext(MockNavContext);
  return (
    <aside className="flex h-full w-[216px] shrink-0 flex-col overflow-hidden bg-sidebar">
      {/* Header — logo, wordmark, collapse control */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 px-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center gap-2.5">
            <Logo size="sm" className="shrink-0" />
            <span className="flex-1 text-[16px] font-bold tracking-tight text-foreground">Seentics</span>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground">
            <PanelLeftClose className="h-4 w-4" />
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-0.5">
          {(nav?.order ?? DEFAULT_ORDER).map((label) => NAV.find((item) => item.label === label)!).map((item) => {
            const isActive = item.label === active;
            const className = cn(
              'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left',
              isActive ? 'bg-muted text-foreground dark:bg-white/[0.08]' : 'text-foreground/60',
            );
            const body = (
              <>
                <item.icon className="h-[17px] w-[17px] shrink-0" />
                <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
              </>
            );
            const explorable = nav?.views.includes(item.label);
            return (
              <li key={item.label}>
                {explorable ? (
                  <button
                    type="button"
                    onClick={() => nav!.onSelect(item.label)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      className,
                      'cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      !isActive && 'hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={cn(className, nav && 'opacity-60')}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account */}
      <div className="shrink-0 px-3 pb-6">
        <span className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary ring-1 ring-border/40">
            AR
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-foreground/90">
            Avery Ross
          </span>
        </span>
      </div>
    </aside>
  );
}
