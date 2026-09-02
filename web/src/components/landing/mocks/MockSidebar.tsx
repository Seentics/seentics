import {
  Activity,
  Banknote,
  Bot,
  Code2,
  Flame,
  GitBranch,
  LayoutDashboard,
  PanelLeftClose,
  Settings,
  Video,
} from 'lucide-react';
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
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Automations', icon: Bot },
  { label: 'Realtime', icon: Activity },
  { label: 'Recording', icon: Video },
  { label: 'Heatmaps', icon: Flame },
  { label: 'Funnels', icon: GitBranch },
  { label: 'Revenue', icon: Banknote },
  { label: 'Developers', icon: Code2 },
  { label: 'Settings', icon: Settings },
] as const;

export type MockNavLabel = (typeof NAV)[number]['label'];

export function MockSidebar({ active = 'Overview' }: { active?: MockNavLabel }) {
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col overflow-hidden bg-sidebar border-r border-sidebar-border dark:border-none">
      {/* Header — logo, wordmark, collapse control */}
      <div className="flex h-[60px] shrink-0 items-center gap-2 px-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex w-full items-center gap-2.5">
            <Logo size="sm" className="shrink-0" />
            <span className="flex-1 text-[16px] font-bold tracking-tight text-primary">Seentics</span>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground">
            <PanelLeftClose className="h-4 w-4" />
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.label}>
              <span
                className={cn(
                  'flex h-10 items-center gap-3 rounded-lg px-3',
                  item.label === active
                    ? 'bg-primary/10 text-primary dark:bg-accent dark:text-foreground'
                    : 'text-foreground/60',
                )}
              >
                <item.icon className="h-[17px] w-[17px] shrink-0" />
                <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
              </span>
            </li>
          ))}
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
