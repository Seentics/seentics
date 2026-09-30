'use client';

import { useRealtimeGeoData } from '@/features/analytics/queries';
import { usePathSegment } from '@/lib/path-segment';
import { RealtimeGeoMapView } from '@/components/analytics/RealtimeGeoMapView';

interface RealtimeGeoMapProps {
  data?: { activities?: any[] };
  isLoading?: boolean;
}

export function RealtimeGeoMap({ data, isLoading: _isLoading }: RealtimeGeoMapProps) {
  // usePathSegment, not useParams — see src/lib/path-segment.ts. On the static shell
  // useParams is the build-time placeholder, and the map queried site "w-leaf".
  const websiteId = usePathSegment(1) ?? '';

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
