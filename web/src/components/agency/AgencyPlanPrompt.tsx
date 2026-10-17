'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * What the prompt is standing in for. Every agency feature takes the Agency plan for every action,
 * reads included (the gateway answers 403 AGENCY_PLAN_REQUIRED): `workspaces` stands in for clients
 * and embed links, `client-access` and `white-label` for those features.
 */
type Gated = 'workspaces' | 'client-access' | 'white-label';

const COPY: Record<Gated, { title: string; description: string }> = {
  workspaces: {
    title: 'Client workspaces and embeds are part of the Agency plan',
    description: 'Upgrade to add clients and embed links, and to manage the ones you have.',
  },
  'client-access': {
    title: 'Client access is part of the Agency plan',
    description: 'Upgrade to send your clients magic links to a read-only portal of their own websites.',
  },
  'white-label': {
    title: 'White label is part of the Agency plan',
    description: 'Upgrade to put your brand, and your own domain, on the portal your clients see.',
  },
};

export function AgencyPlanPrompt({ websiteId, feature = 'workspaces', className }: { websiteId: string; feature?: Gated; className?: string }) {
  const copy = COPY[feature];
  return (
    <div
      data-testid="agency-plan-prompt"
      className={cn('flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between', className)}
    >
      <div className="flex gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{copy.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/websites/${websiteId}/settings/billing`}>Billing</Link>
        </Button>
        <Button size="sm" className="gap-1.5" asChild>
          <Link href="/pricing">
            See the Agency plan <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
