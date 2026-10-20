'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { AiModeButton } from '@/components/ai/AiModeButton';
import { ThemeToggle } from '@/components/theme-toggle';
import { useIsPathOverridden } from '@/lib/path-segment';
import { cn } from '@/lib/utils';

/**
 * A list page in the manner of Linear: a slim bar with the page's name and its views, an
 * optional filter bar, then rows grouped under compact headers. Almost monochrome — colour
 * only in the small status icons and the dots inside labels.
 */

/**
 * The page fills the dashboard's frame edge to edge; the bars and groups carry the lines.
 * `shrink-0`: the frame is a flex column, and a page allowed to shrink to the window's
 * height clips its own list instead of letting the frame scroll.
 */
export const LIST_PAGE = 'flex min-h-full w-full shrink-0 flex-col text-[13px] tracking-[-0.005em]';

/**
 * The page's heading, on the page itself rather than in a bar: the title (under its parent, as a
 * breadcrumb, when it has one) and a line saying what the page is for on the left; the page's
 * actions, such as the date range, and the theme toggle on the right; the views under it. Lined
 * up with the panels below (their 12 / 16px inset). The toggle is left out inside the landing
 * page's preview, where it would switch the whole landing page, and where `themeToggle` is false
 * (an embed).
 */
export function PageBar({ title, parent, description, views, children, themeToggle = true }: {
  title: string;
  /** The page this one sits under, as a breadcrumb above the title: "Funnels / Checkout". */
  parent?: { label: string; onClick: () => void };
  /** One line under the title saying what the page is for. */
  description?: ReactNode;
  views?: ReactNode;
  children?: ReactNode;
  themeToggle?: boolean;
}) {
  // Inside the landing page's preview the title is a section heading — see DashboardPageTitle.
  const overridden = useIsPathOverridden();
  const Heading = overridden ? 'h2' : 'h1';
  return (
    <header className="flex flex-wrap items-start gap-x-6 gap-y-3 px-3 pt-5 md:px-4 md:pt-6">
      <div className="min-w-0 flex-1">
        {parent && (
          <div className="mb-1 flex items-center gap-1 text-[12.5px] text-muted-foreground">
            <button type="button" onClick={parent.onClick} className="rounded transition-colors hover:text-foreground">{parent.label}</button>
            <ChevronRight aria-hidden className="size-3 text-muted-foreground/60" />
          </div>
        )}
        <Heading className="min-w-0 truncate text-[20px] font-semibold leading-tight tracking-[-0.015em] text-foreground">{title}</Heading>
        {description && <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-muted-foreground">{description}</p>}
        {views && <div className="mt-3">{views}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {children}
        {themeToggle && !overridden && <ThemeToggle className="h-8 w-8 [&_svg]:!size-4" />}
      </div>
    </header>
  );
}

/**
 * A report or settings-like page in the same frame as the list pages: the page heading with
 * its description and actions (and AI Mode for a website), then the page's own content, padded
 * and centred.
 */
export function ReportPage({
  title, parent, description, views, actions, websiteId, width = 'max-w-[1440px]', bodyClassName, children,
}: {
  title: string;
  parent?: { label: string; onClick: () => void };
  description?: ReactNode;
  views?: ReactNode;
  actions?: ReactNode;
  /** Shows AI Mode for this website in the bar. */
  websiteId?: string;
  /** The body's max width class. */
  width?: string;
  /** Classes for the body, such as the spacing between its sections. */
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={LIST_PAGE}>
      <PageBar title={title} parent={parent} description={description} views={views}>
        {/* Pages pass their usual buttons; in the bar they take its height. */}
        {actions && <div className="flex flex-wrap items-center gap-1.5 [&_button]:h-7 [&_button]:text-[12.5px] [&_a]:h-7 [&_a]:text-[12.5px]">{actions}</div>}
        {websiteId && <AiModeButton websiteId={websiteId} className="h-7" />}
      </PageBar>
      <div className={cn('mx-auto w-full p-4 md:p-5 lg:px-6 lg:py-5', width, bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

/** A second bar under the top one, for filters and display options. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-border px-4 py-1.5">{children}</div>;
}

export interface ViewTab<T extends string> {
  id: T;
  label: string;
}

/** The page's saved views, as small chips in the top bar: "All sessions · Needs a look". */
export function ViewTabs<T extends string>({ tabs, value, onChange, label }: { tabs: ViewTab<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-0.5">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              'h-6 rounded-md border px-2 text-[12.5px] font-medium transition-colors',
              on ? 'border-border bg-muted text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** A small borderless button for the bars. */
export const GHOST_BUTTON = 'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground';

/** A group's header row: chevron, its icon, its name and count. Click to fold the group. */
export function GroupHeader({ icon, label, count, open, onToggle }: { icon: ReactNode; label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      // A stone band: a warm grey, apart from the white rows under it and from the cool grey page
      // around the panel, in both themes.
      className="flex h-10 w-full items-center gap-2 border-b border-stone-300/60 bg-stone-200/70 px-4 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-stone-200 dark:border-stone-700/50 dark:bg-stone-800/60 dark:hover:bg-stone-800/80"
    >
      <ChevronRight className={cn('size-3 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden />
      <span aria-hidden className="inline-flex">{icon}</span>
      {label}
      <span className="rounded-full bg-card px-1.5 py-px text-[11px] font-medium tabular-nums text-muted-foreground">{count.toLocaleString()}</span>
    </button>
  );
}

/** A thin outlined label with a coloured dot: the only colour in a row. */
export function DotLabel({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2 text-[11.5px] text-foreground/75">
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

/** The dots' colours, Linear's: red, orange, indigo, violet, green. */
export const DOT = {
  red: '#eb5757',
  orange: '#f2994a',
  indigo: '#5e6ad2',
  violet: '#bb87fc',
  green: '#4cb782',
  grey: '#8a8f98',
} as const;
export type DotTone = keyof typeof DOT;

// ── Status icons, 14px ────────────────────────────────────────────────────────

/** Urgent: a red rounded square with "!". */
export function UrgentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="1" y="1" width="12" height="12" rx="3" fill={DOT.red} />
      <path d="M7 3.8v3.8M7 9.6v.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Signal bars, the tallest in a colour: something went wrong, short of an error. */
export function BarsIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-foreground/60">
      <rect x="1.5" y="8" width="2.6" height="4.5" rx="1" fill="currentColor" />
      <rect x="5.7" y="5" width="2.6" height="7.5" rx="1" fill="currentColor" />
      <rect x="9.9" y="2" width="2.6" height="10.5" rx="1" fill={color} />
    </svg>
  );
}

/** Three flat dashes: nothing to report. */
export function CalmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-muted-foreground">
      <rect x="1.5" y="6.2" width="2.6" height="1.6" rx=".8" fill="currentColor" />
      <rect x="5.7" y="6.2" width="2.6" height="1.6" rx=".8" fill="currentColor" />
      <rect x="9.9" y="6.2" width="2.6" height="1.6" rx=".8" fill="currentColor" />
    </svg>
  );
}

/** A half-filled orange circle: worth a look, not urgent. */
export function HalfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke={DOT.orange} strokeWidth="1.6" />
      <path d="M7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill={DOT.orange} />
    </svg>
  );
}

/** A green tick in a circle: fine. */
export function DoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="6" fill={DOT.green} />
      <path d="M4.4 7.2l1.8 1.8 3.4-3.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A dashed grey circle: not enough to say yet. */
export function PendingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke={DOT.grey} strokeWidth="1.5" strokeDasharray="2.2 2" />
    </svg>
  );
}
