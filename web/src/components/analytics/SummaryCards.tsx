'use client';

import {
  SummaryCardsView,
  type SummaryCardsData,
} from '@/components/analytics/SummaryCardsView';
import { useLiveVisitors } from '@/features/analytics/queries';

export type { SummaryCardsData } from '@/components/analytics/SummaryCardsView';

interface SummaryCardsProps {
  data?: SummaryCardsData | null;
  websiteId?: string;
  isDemo?: boolean;
  isLoading?: boolean;
  /** @deprecated Summary cards never consume this; retained for source compatibility. */
  dailyStats?: unknown;
  /** @deprecated Summary cards never consume this; retained for source compatibility. */
  visitorInsights?: unknown;
}

/**
 * Production data adapter for the reusable summary view. The dashboard route owns
 * API access; demos and content-engine scenes should render SummaryCardsView directly.
 */
export function SummaryCards({ data, websiteId, isDemo = false, isLoading = false }: SummaryCardsProps) {
  const { data: liveVisitors } = useLiveVisitors(websiteId ?? '');

  return (
    <SummaryCardsView
      data={data}
      isLoading={isLoading}
      liveVisitors={isDemo ? (data?.live_visitors ?? 0) : (liveVisitors ?? 0)}
    />
  );
}
