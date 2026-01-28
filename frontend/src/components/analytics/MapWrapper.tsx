'use client';

import { useEffect, useState } from 'react';

interface CountryData {
  name: string;
  count: number;
  percentage: number;
}

interface MapWrapperProps {
  data: CountryData[];
  className?: string;
}

export default function MapWrapper({ data, className = '' }: MapWrapperProps) {
  const [mapComponent, setMapComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    // Only load on client side
    if (typeof window !== 'undefined') {
      // Import Leaflet components
      Promise.all([
        import('react-leaflet'),
        import('leaflet')
      ]).then(([reactLeaflet, L]) => {
        const { MapContainer, TileLayer, CircleMarker, Popup } = reactLeaflet;

        // Fix Leaflet default markers issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Country coordinates
        const countryCoordinates: Record<string, [number, number]> = {
          'United States': [39.8283, -98.5795],
          'United Kingdom': [55.3781, -3.4360],
          'Germany': [51.1657, 10.4515],
          'Canada': [56.1304, -106.3468],
          'France': [46.2276, 2.2137],
          'Australia': [-25.2744, 133.7751],
          'Japan': [36.2048, 138.2529],
          'Netherlands': [52.1326, 5.2913],
          'India': [20.5937, 78.9629],
          'Brazil': [-14.2350, -51.9253],
          'Spain': [40.4637, -3.7492],
          'Italy': [41.8719, 12.5674]
        };

        const MapComponent = ({ data, className }: { data: CountryData[], className: string }) => {
          // Prepare map data with coordinates
          const mapData = data
            .filter(country => countryCoordinates[country.name])
            .map(country => ({
              ...country,
              coordinates: countryCoordinates[country.name],
              markerSize: Math.max(8, Math.min(30, (country.count / Math.max(...data.map(d => d.count))) * 25))
            }));

          // Get marker color based on visitor count
          const getMarkerColor = (count: number): string => {
            const maxCount = Math.max(...data.map(d => d.count));
            const intensity = count / maxCount;
            if (intensity > 0.8) return '#DC2626'; // Red
            if (intensity > 0.6) return '#EA580C'; // Orange
            if (intensity > 0.4) return '#D97706'; // Amber
            if (intensity > 0.2) return '#059669'; // Emerald
            return '#3B82F6'; // Blue
          };

          return (
            <div className={`h-[32rem] rounded overflow-hidden border border-gray-200 dark:border-gray-700 relative ${className}`}>
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {mapData.map((country, index) => (
                  <CircleMarker
                    key={`${country.name}-${index}`}
                    center={country.coordinates}
                    radius={country.markerSize}
                    pathOptions={{
                      fillColor: getMarkerColor(country.count),
                      color: getMarkerColor(country.count),
                      weight: 2,
                      opacity: 0.8,
                      fillOpacity: 0.6,
                    }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-semibold text-lg mb-2">{country.name}</h3>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Visitors:</span>
                            <span className="font-medium">{country.count.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Percentage:</span>
                            <span className="font-medium">{country.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          );
        };

        setMapComponent(() => MapComponent);
      }).catch((error) => {
        console.error('Failed to load map components:', error);
      });
    }
  }, []);

  if (!mapComponent) {
    return (
      <div className={`h-[32rem] bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 rounded flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading interactive map...</p>
        </div>
      </div>
    );
  }

  const MapComponent = mapComponent;
  return <MapComponent data={data} className={className} />;
}
