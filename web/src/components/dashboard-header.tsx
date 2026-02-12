'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
  uppercase?: boolean;
}

export function DashboardPageHeader({
  title,
  description,
  icon: Icon,
  children,
  className,
  uppercase = false,
}: DashboardPageHeaderProps) {
  return (
    <div className={cn("flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className={cn(
            "text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white transition-all",
            uppercase ? "uppercase" : "capitalize"
          )}>
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-muted-foreground font-medium text-sm sm:text-base max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
