'use client';

import { AICommandModal } from '@/components/ai/AICommandModal';
import { DetailedDataModal } from '@/components/analytics/DetailedDataModal';
import { FilterModal, type AdvancedFilters } from '@/components/analytics/FilterModal';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { AddGoalModal } from '@/components/websites/modals/AddGoalModal';
import { InviteMemberModal } from '@/components/websites/modals/InviteMemberModal';
import { TrackingCodeModal } from '@/components/websites/tracking-code-modal';
import { demoAnalyticsData } from '@/lib/demo';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export const CONTENT_MODAL_IDS = [
  'ai',
  'filters',
  'details',
  'add-website',
  'add-goal',
  'invite-member',
  'tracking-code',
] as const;

export type ContentModalId = (typeof CONTENT_MODAL_IDS)[number];

function isContentModalId(value: string | null): value is ContentModalId {
  return CONTENT_MODAL_IDS.some((modal) => modal === value);
}

/**
 * Demo-only modal host. It keeps real production modal implementations in one
 * place while allowing content-engine to open an exact customer-facing state by
 * appending `?contentModal=<id>` to any `/websites/demo/...` route.
 */
export function DashboardContentOverlay({ websiteId }: { websiteId: string }) {
  const searchParams = useSearchParams();
  const requestedModal = searchParams.get('contentModal');
  const modal = websiteId === 'demo' && isContentModalId(requestedModal) ? requestedModal : null;
  const [dismissedModal, setDismissedModal] = useState<ContentModalId | null>(null);
  const [filters, setFilters] = useState<AdvancedFilters>({ country: 'United States' });

  useEffect(() => {
    setDismissedModal(null);
  }, [modal]);

  const isOpen = (modalId: ContentModalId) => modal === modalId && dismissedModal !== modalId;
  const close = (modalId: ContentModalId) => setDismissedModal(modalId);
  const analytics = useMemo(() => demoAnalyticsData(), []);

  if (!modal) return null;

  return (
    <>
      <AICommandModal websiteId={websiteId} open={isOpen('ai')} onOpenChange={(open) => !open && close('ai')} />

      <FilterModal
        open={isOpen('filters')}
        onOpenChange={(open) => !open && close('filters')}
        dateRange={30}
        isCustomRange={false}
        onDateRangeChange={() => undefined}
        onCustomDateChange={() => undefined}
        currentFilters={filters}
        activeFiltersCount={Object.keys(filters).length}
        onFiltersChange={setFilters}
      />

      <DetailedDataModal
        isOpen={isOpen('details')}
        onClose={() => close('details')}
        modalType="traffic"
        data={{
          dashboard: analytics.dashboardData,
          dailyStats: analytics.dailyStats,
          topPages: analytics.topPages,
          topReferrers: analytics.topReferrers,
          topCountries: analytics.topCountries,
          topBrowsers: analytics.topBrowsers,
          topDevices: analytics.topDevices,
        }}
        isLoading={{}}
      />

      <AddWebsiteModal
        open={isOpen('add-website')}
        onOpenChange={(open) => !open && close('add-website')}
        onSuccess={() => undefined}
      />

      <AddGoalModal
        open={isOpen('add-goal')}
        onOpenChange={(open) => !open && close('add-goal')}
        websiteId={websiteId}
      />

      <InviteMemberModal
        open={isOpen('invite-member')}
        onOpenChange={(open) => !open && close('invite-member')}
        websiteId={websiteId}
      />

      <TrackingCodeModal
        isOpen={isOpen('tracking-code')}
        onOpenChange={(open) => !open && close('tracking-code')}
        siteId="production-demo"
      />
    </>
  );
}
