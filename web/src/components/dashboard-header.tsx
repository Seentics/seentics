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

            {children}
          </>
        )}
      />
  );
}
