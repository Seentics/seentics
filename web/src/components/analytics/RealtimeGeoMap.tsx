'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { useRealtimeGeoData } from '@/lib/analytics-api';

const WorldMap = dynamic(() => import('./WorldMap'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[400px] rounded-lg" />,
});

interface RealtimeGeoMapProps {
  data?: { activities?: any[] };
  isLoading?: boolean;
}

export function RealtimeGeoMap({ data, isLoading: _isLoading }: RealtimeGeoMapProps) {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  // Use the new API for real data, fallback to activity-based aggregation for demo
  const { data: geoData, isLoading: apiLoading } = useRealtimeGeoData(websiteId, 30);

  const isLoading = apiLoading || _isLoading;

  // Convert API response to WorldMap format
  const mapData = geoData?.visitors?.map(v => ({
    name: v.name,
    code: v.code,
    count: v.count,
    percentage: v.percentage,
  })) || [];

  if (isLoading) {
    return <Skeleton className="w-full h-[400px] rounded-lg" />;
  }

  return (
    <div className="surface surface-raised overflow-hidden">
      <div className="px-4 py-3 md:px-5 md:py-3.5 border-b border-border">
        <h3 className="text-base font-medium tracking-tight text-foreground">Live Visitor Locations</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time geographic distribution of active visitors.
        </p>
      </div>
      <div className="p-4 md:p-5 h-[500px]">
        <WorldMap data={mapData} view="globe" showLegend={false} />
      </div>
    </div>
  );
}
