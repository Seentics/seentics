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
                'group flex items-center gap-2.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2',
                'text-sm font-medium text-indigo-400 transition-all',
                'hover:border-indigo-500/60 hover:bg-indigo-500/15 hover:text-indigo-300',
                aiUsage && !aiUsage.canCreate && 'opacity-60',
              )}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Ask Seentics AI</span>
              <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400/80 tracking-wide">
                BETA
              </span>
              <kbd className="hidden rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] sm:inline-block">
                ⌘K
              </kbd>
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
