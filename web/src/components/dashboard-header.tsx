'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AICommandModal } from '@/components/ai/AICommandModal';
import { useSubscription } from '@/hooks/useSubscription';

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
  const [aiOpen, setAiOpen] = useState(false);
  const { subscription } = useSubscription();

  const aiUsage = subscription?.usage?.aiAnalyses;

  return (
    <>
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

        <div className="flex flex-wrap items-center gap-3">
          {/* AI Command button — only shown on website-scoped pages */}
          {websiteId && (
            <button
              onClick={() => setAiOpen(true)}
              title="Seentics AI (⌘K)"
              className={cn(
                'group flex h-9 items-center gap-1 rounded-lg border-none px-4 text-[14px] font-medium transition-all',
                "bg-card",
                aiUsage && !aiUsage.canCreate && 'opacity-60',
              )}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>Ask AI (⌘K)</span>
            </button>
          )}

          {children && <>{children}</>}
        </div>
      </div>

      {websiteId && (
        <AICommandModal
          websiteId={websiteId}
          open={aiOpen}
          onOpenChange={setAiOpen}
          aiUsage={aiUsage}
        />
      )}
    </>
  );
}
