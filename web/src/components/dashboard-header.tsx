'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  uppercase?: boolean;
}

export function DashboardPageHeader({
  title,
  description,
  children,
  className,
  uppercase = false,
}: DashboardPageHeaderProps) {
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
          <p className="max-w-2xl text-sm font-medium text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
