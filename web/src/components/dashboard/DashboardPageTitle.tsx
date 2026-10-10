import { cn } from '@/lib/utils';
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
  return (
    <div className={cn('mb-4 flex flex-col justify-between gap-4 xl:flex-row xl:items-center', className)}>
      <div className="space-y-0.5">
        <h1
          className={cn(
            'text-lg font-semibold tracking-tight text-foreground sm:text-xl',
            uppercase ? 'uppercase' : 'capitalize',
          )}
        >
          {title}
        </h1>
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
