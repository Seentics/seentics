'use client';

import { formatNumber } from '@/lib/analytics-api';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface CountryData {
  name: string;
  count: number;
  percentage: number;
}

interface LeafletMapProps {
  data: CountryData[];
  className?: string;
}

// Country coordinates mapping (major countries)
const countryCoordinates: Record<string, [number, number]> = {
  'United States': [39.8283, -98.5795],
  'USA': [39.8283, -98.5795],
  'US': [39.8283, -98.5795],
  'Canada': [56.1304, -106.3468],
  'United Kingdom': [55.3781, -3.4360],
  'UK': [55.3781, -3.4360],
  'Germany': [51.1657, 10.4515],
  'France': [46.2276, 2.2137],
  'Italy': [41.8719, 12.5674],
  'Spain': [40.4637, -3.7492],
  'Netherlands': [52.1326, 5.2913],
  'Belgium': [50.5039, 4.4699],
  'Switzerland': [46.8182, 8.2275],
  'Austria': [47.5162, 14.5501],
  'Poland': [51.9194, 19.1451],
  'Sweden': [60.1282, 18.6435],
  'Norway': [60.4720, 8.4689],
  'Denmark': [56.2639, 9.5018],
  'Finland': [61.9241, 25.7482],
  'Russia': [61.5240, 105.3188],
  'China': [35.8617, 104.1954],
  'Japan': [36.2048, 138.2529],
  'South Korea': [35.9078, 127.7669],
  'India': [20.5937, 78.9629],
  'Bangladesh': [23.6850, 90.3563],
  'Pakistan': [30.3753, 69.3451],
  'Thailand': [15.8700, 100.9925],
  'Vietnam': [14.0583, 108.2772],
  'Indonesia': [-0.7893, 113.9213],
  'Philippines': [12.8797, 121.7740],
  'Malaysia': [4.2105, 101.9758],
  'Singapore': [1.3521, 103.8198],
  'Australia': [-25.2744, 133.7751],
  'New Zealand': [-40.9006, 174.8860],
  'Brazil': [-14.2350, -51.9253],
  'Argentina': [-38.4161, -63.6167],
  'Chile': [-35.6751, -71.5430],
  'Mexico': [23.6345, -102.5528],
  'Colombia': [4.5709, -74.2973],
  'Peru': [-9.1900, -75.0152],
  'Venezuela': [6.4238, -66.5897],
  'South Africa': [-30.5595, 22.9375],
  'Nigeria': [9.0820, 8.6753],
  'Egypt': [26.0975, 30.0444],
  'Kenya': [-0.0236, 37.9062],
  'Morocco': [31.7917, -7.0926],
  'Algeria': [28.0339, 1.6596],
  'Tunisia': [33.8869, 9.5375],
  'Ghana': [7.9465, -1.0232],
  'Ethiopia': [9.1450, 40.4897],
  'Turkey': [38.9637, 35.2433],
  'Israel': [31.0461, 34.8516],
  'Saudi Arabia': [23.8859, 45.0792],
  'UAE': [23.4241, 53.8478],
  'Iran': [32.4279, 53.6880],
  'Iraq': [33.2232, 43.6793],
};

export default function LeafletMap({ data, className = '' }: LeafletMapProps) {
  // Prepare map data with coordinates
  const mapData = data
    .filter(country => countryCoordinates[country.name])
    .map(country => ({
      ...country,
      coordinates: countryCoordinates[country.name],
      // Calculate marker size based on visitor count (min 8, max 30)
      markerSize: Math.max(8, Math.min(30, (country.count / Math.max(...data.map(d => d.count))) * 25))
    }));

  // Calculate max count for color scaling
  const maxCount = Math.max(...data.map(d => d.count));

  // Get marker color based on visitor count
  const getMarkerColor = (count: number): string => {
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
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: getMarkerColor(country.count) }}
                  ></div>
                  <h3 className="font-semibold text-lg">{country.name}</h3>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visitors:</span>
                    <span className="font-medium">{formatNumber(country.count)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Percentage:</span>
                    <span className="font-medium">{country.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(country.percentage, 100)}%`,
                        backgroundColor: getMarkerColor(country.count)
                      }}
                    />
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded shadow-lg p-3 z-[1000]">
        <h4 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">Visitor Distribution</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-gray-600 dark:text-gray-400">High (80%+)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-orange-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Medium-High (60-80%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-amber-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Medium (40-60%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Low-Medium (20-40%)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-gray-600 dark:text-gray-400">Low (0-20%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
