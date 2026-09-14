'use client';

import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

const WorldMap = dynamic(() => import('@/components/analytics/WorldMap'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[400px] rounded-lg" />,
});

export interface RealtimeGeoMapViewProps {
  data?: Array<{ name: string; code?: string; count: number; percentage: number }>;
  isLoading?: boolean;
}

/** Data-only realtime map. The route adapter supplies API results. */
export function RealtimeGeoMapView({ data = [], isLoading = false }: RealtimeGeoMapViewProps) {
  if (isLoading) return <Skeleton className="w-full h-[400px] rounded-lg" />;

  return (
    <div className="surface overflow-hidden">
      <div className="px-4 py-3 md:px-5 md:py-3.5 border-b border-border">
        <h3 className="text-base font-medium tracking-tight text-foreground">Live Visitor Locations</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time geographic distribution of active visitors.
        </p>
      </div>
      <div className="p-4 md:p-5 h-[500px]">
        <WorldMap data={data} view="globe" showLegend={false} />
      </div>
    </div>
  );
}
