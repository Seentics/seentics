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
        title="User Paths"
        description="Discover the most common journeys users take through your product."
      />
      <StatCards
        cards={[
          { label: 'Avg Path Length', value: '3.4', icon: Route, iconColor: 'text-indigo-600' },
          { label: 'Sessions Analyzed', value: '12,543', icon: Users },
          { label: 'Top Journey', value: '/ → /pricing', icon: TrendingUp, iconColor: 'text-blue-600' },
          { label: 'Avg Time', value: '4m 12s', icon: Clock },
        ]}
      />
      
      <PathAnalysis websiteId={websiteId} dateRange={30} />
    </div>
  );
}
