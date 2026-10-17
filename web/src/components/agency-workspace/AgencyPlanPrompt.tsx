'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Stands in for the workspace when the account is not on the Agency plan: every agency endpoint,
 * reads included, answers 403 `agency_plan_required` without it.
 */
export function AgencyPlanPrompt({ websiteId, className }: { websiteId: string | null; className?: string }) {
  return (
    <div
      data-testid="agency-plan-prompt"
      className={cn('flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between', className)}
    >
      <div className="flex gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">The agency workspace is part of the Agency plan</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Upgrade to add clients and their websites, put your brand on what they see, and use the agency API.</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {websiteId && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/websites/${websiteId}/settings/billing`}>Billing</Link>
          </Button>
        )}
        <Button size="sm" className="gap-1.5" asChild>
          <Link href="/pricing">
            See the Agency plan <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
