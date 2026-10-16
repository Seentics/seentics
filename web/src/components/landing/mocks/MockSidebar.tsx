'use client';

import {
  Banknote,
  Bot,
  Bug,
  Code2,
  Flame,
  GitBranch,
  LayoutDashboard,
  PanelLeftClose,
  Radio,
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
  { label: 'Revenue', icon: Banknote },
  { label: 'AI Reports', icon: Sparkles },
  { label: 'Errors', icon: Bug },
  { label: 'Developers', icon: Code2 },
  { label: 'Settings', icon: Settings },
] as const;

/** The suite's other apps, as the real sidebar lists them under "Workspace". */
const WORKSPACE = [
  { label: 'Observability', icon: Radio, tint: 'text-[hsl(267_60%_47%)] dark:text-[hsl(267_75%_70%)]' },
] as const;

export type MockNavLabel = (typeof NAV)[number]['label'];

/**
 * Set by the landing hero to make the mock explorable: the sidebar items it has a screen
 * for become buttons that switch to it. Everywhere else (no provider) the mock stays a
 * still picture.
 */
export const MockNavContext = createContext<{
  views: readonly MockNavLabel[];
  onSelect: (label: MockNavLabel) => void;
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
 * The page's frame, as the dashboard draws it from md up (app/websites/[websiteId]/layout.tsx):
 * a rounded, hairline-edged panel inset from the window, with the sidebar on the chrome around it.
 */
export const MOCK_FRAME = 'my-2 mr-2 overflow-hidden rounded-xl border border-border app-frame app-frame-lit shadow-[var(--panel-edge)]';

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
          {NAV.map((item) => {
            const isActive = item.label === active;
            const className = cn(
              'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left',
              isActive ? 'bg-accent text-foreground' : 'text-foreground/60',
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

      {/* Workspace */}
      <div className="shrink-0 border-t border-sidebar-border px-3 pb-2 pt-3 dark:border-border/60">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">Workspace</p>
        <ul className="space-y-0.5">
          {WORKSPACE.map((item) => (
            <li key={item.label}>
              <span className="flex h-10 items-center gap-3 rounded-lg px-3 text-foreground/60">
                <item.icon className={cn('h-[17px] w-[17px] shrink-0', item.tint)} />
                <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

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
