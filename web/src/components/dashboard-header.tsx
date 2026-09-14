'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { DashboardPageTitle } from '@/components/dashboard/DashboardPageTitle';

interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  uppercase?: boolean;
  /** Pass websiteId to enable the AI analytics button on this page */
  websiteId?: string;
}

export function DashboardPageHeader({
  title,
  description,
  children,
  className,
  uppercase = false,
  websiteId,
}: DashboardPageHeaderProps) {
  return (
      <DashboardPageTitle
        title={title}
        description={description}
        className={className}
        uppercase={uppercase}
        actions={(
          <>
          {/* AI Command button — only shown on website-scoped pages */}
          {websiteId && (
            <Link
              href={`/websites/${websiteId}/ai`}
              title="Open AI Mode"
              className="group flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>AI Mode</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )}

            {children}
          </>
        )}
      />
  );
}
