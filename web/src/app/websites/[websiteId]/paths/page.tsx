'use client';

import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { PathAnalysis } from '@/components/analytics/PathAnalysis';
import { Route, Clock, TrendingUp, Users } from 'lucide-react';
import { StatCards } from '@/components/seentics-ui/StatCards';

export default function PathsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        websiteId={websiteId}
        title="User Paths"
        description="Discover the most common journeys users take through your product."
      />
      <StatCards
        cards={[
          { label: 'Avg Path Length', value: '3.4', icon: Route, tone: 'accent' },
          { label: 'Sessions Analyzed', value: '12,543', icon: Users, tone: 'info' },
          { label: 'Top Journey', value: '/ → /pricing', icon: TrendingUp, tone: 'success' },
          { label: 'Avg Time', value: '4m 12s', icon: Clock, tone: 'warning' },
        ]}
      />
      
      <PathAnalysis websiteId={websiteId} dateRange={30} />
    </div>
  );
}
