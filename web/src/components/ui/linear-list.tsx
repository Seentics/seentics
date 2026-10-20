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

/** The page fills the dashboard's frame edge to edge; the bars and groups carry the lines. */
export const LIST_PAGE = 'flex min-h-full w-full flex-col text-[13px] tracking-[-0.005em]';

/**
 * The top bar: icon, name, a divider, the views, then the page's actions and the theme toggle
 * on the right. The toggle is left out inside the landing page's preview, where it would
 * switch the whole landing page, and where `themeToggle` is false (an embed).
 */
export function PageBar({ icon, title, parent, views, children, themeToggle = true }: {
  icon: ReactNode;
  title: string;
  /** The page this one sits under, as a breadcrumb before the title: "Funnels / Checkout". */
  parent?: { label: string; onClick: () => void };
  views?: ReactNode;
  children?: ReactNode;
  themeToggle?: boolean;
}) {
  // Inside the landing page's preview the title is a section heading — see DashboardPageTitle.
  const overridden = useIsPathOverridden();
  const Heading = overridden ? 'h2' : 'h1';
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1 border-b border-border px-4 py-1.5">
      <span className="mr-1.5 text-muted-foreground [&_svg]:size-3.5" aria-hidden>{icon}</span>
      {parent && (
        <>
          <button type="button" onClick={parent.onClick} className="rounded px-0.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            {parent.label}
          </button>
          <ChevronRight aria-hidden className="size-3 text-muted-foreground/60" />
        </>
      )}
      <Heading className="min-w-0 truncate text-[13px] font-medium text-foreground">{title}</Heading>
      {views && <><span aria-hidden className="mx-2.5 h-3.5 w-px bg-border" />{views}</>}
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {children}
        {themeToggle && !overridden && <ThemeToggle className="h-7 w-7 [&_svg]:!size-3.5" />}
      </div>
    </div>
  );
}

/**
 * A report or settings-like page in the same frame as the list pages: the slim top bar with
 * the page's actions (and AI Mode for a website), then the page's own content, padded and
 * centred. The description, which the old header carried under the title, opens the body.
 */
export function ReportPage({
  icon, title, parent, description, views, actions, websiteId, width = 'max-w-[1440px]', bodyClassName, children,
}: {
  icon: ReactNode;
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
      <PageBar icon={icon} title={title} parent={parent} views={views}>
        {/* Pages pass their usual buttons; in the bar they take its height. */}
        {actions && <div className="flex flex-wrap items-center gap-1.5 [&_button]:h-7 [&_button]:text-[12.5px] [&_a]:h-7 [&_a]:text-[12.5px]">{actions}</div>}
        {websiteId && <AiModeButton websiteId={websiteId} className="h-7" />}
      </PageBar>
      <div className={cn('mx-auto w-full p-4 md:p-5 lg:px-6 lg:py-5', width, bodyClassName)}>
        {description && <p className="mb-5 max-w-3xl text-muted-foreground">{description}</p>}
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
      className="flex h-9 w-full items-center gap-2 border-b border-border bg-muted/50 px-4 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
    >
      <ChevronRight className={cn('size-3 text-muted-foreground transition-transform', open && 'rotate-90')} aria-hidden />
      <span aria-hidden className="inline-flex">{icon}</span>
      {label}
      <span className="font-normal text-muted-foreground">{count.toLocaleString()}</span>
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
