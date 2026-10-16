'use client';

import { cn } from '@/lib/utils';
import { useIsPathOverridden } from '@/lib/path-segment';
import type { ReactNode } from 'react';

export interface DashboardPageTitleProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  uppercase?: boolean;
}

/**
 * Stateless page chrome shared by production routes and deterministic product
 * scenes. Route-specific adapters provide actions such as AI or refresh.
 */
export function DashboardPageTitle({
  title,
  description,
  actions,
  className,
  uppercase = false,
}: DashboardPageTitleProps) {
  // Inside the landing page's preview the page title is a section heading: the landing
  // page has its own h1, and a dozen more told search engines the page was about each.
  const Heading = useIsPathOverridden() ? 'h2' : 'h1';
  return (
    <div className={cn('mb-4 flex flex-col justify-between gap-4 xl:flex-row xl:items-center', className)}>
      <div className="space-y-0.5">
        <Heading
          className={cn(
            'text-lg font-semibold tracking-tight text-foreground sm:text-xl',
            uppercase ? 'uppercase' : 'capitalize',
          )}
        >
          {title}
        </Heading>
        {description && (
          <p className="max-w-3xl text-[13px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
