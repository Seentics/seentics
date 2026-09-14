'use client';

import { useParams } from 'next/navigation';
import { useRealtimeGeoData } from '@/features/analytics/queries';
import { RealtimeGeoMapView } from '@/components/analytics/RealtimeGeoMapView';

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

  return <RealtimeGeoMapView data={mapData} isLoading={isLoading} />;
}
