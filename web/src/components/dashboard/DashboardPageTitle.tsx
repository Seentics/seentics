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
    <div className={cn('mb-8 flex flex-col justify-between gap-6 xl:flex-row xl:items-center', className)}>
      <div className="space-y-1">
        <h1
          className={cn(
            'text-2xl font-bold tracking-tight text-foreground transition-all sm:text-3xl',
            uppercase ? 'uppercase' : 'capitalize',
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-sm font-medium text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
