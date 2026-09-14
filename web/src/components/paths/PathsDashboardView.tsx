import { DashboardPageTitle } from '@/components/dashboard/DashboardPageTitle';
import { StatCards, type StatCard } from '@/components/seentics-ui/StatCards';
import type { ReactNode } from 'react';

export interface PathsDashboardViewProps {
  websiteId?: string;
  header?: ReactNode;
  stats: StatCard[];
  analysis: ReactNode;
}

/** Layout-only paths screen; adapters own data loading and analytics interactions. */
export function PathsDashboardView({ header, stats, analysis }: PathsDashboardViewProps) {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      {header ?? (
        <DashboardPageTitle
          title="User Paths"
          description="Discover the most common journeys users take through your product."
        />
      )}
      <StatCards cards={stats} />
      {analysis}
    </div>
  );
}
