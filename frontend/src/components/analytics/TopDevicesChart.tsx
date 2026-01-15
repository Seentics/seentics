'use client';

import { Monitor, PieChart, Smartphone, Tablet } from 'lucide-react';
import Image from 'next/image';
import { Cell, Legend, Pie, ResponsiveContainer, Tooltip } from 'recharts';

interface TopDevicesChartProps {
  data?: {
    top_devices: Array<{
      device: string;
      visitors: number;
      page_views: number;
      avg_session_duration: number;
    }>;
  };
  isLoading?: boolean;
  onViewMore?: () => void;
}

export function TopDevicesChart({ data, isLoading, onViewMore }: TopDevicesChartProps) {
  // Use real data if available, otherwise show empty state
  const deviceData = data?.top_devices?.map((item, index) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    const totalVisitors = data.top_devices.reduce((sum, d) => sum + d.visitors, 0);
    const percentage = totalVisitors > 0 ? Math.round((item.visitors / totalVisitors) * 100) : 0;

    return {
      device: item.device,
      visitors: item.visitors,
      percentage: percentage,
      color: colors[index % colors.length]
    };
  }) || [];

  const COLORS = deviceData.map(d => d.color);

  // Helper function to get appropriate image for device
  const getDeviceImage = (device: string) => {
    const lowerDevice = device.toLowerCase();

    if (lowerDevice.includes('mobile') || lowerDevice.includes('phone')) return '/images/phone.png';
    if (lowerDevice.includes('tablet')) return '/images/tablet.png';
    if (lowerDevice.includes('desktop') || lowerDevice.includes('pc')) return '/images/monitor.png';

    return '/images/monitor.png'; // Default fallback
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1"></div>
                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.top_devices || data.top_devices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="text-sm">No device data available</div>
        <div className="text-xs">Device data will appear here once visitors start coming to your site</div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Device List with Icons */}
        <div className="space-y-3">
          {deviceData.map((item, index) => {
            return (
              <div key={item.device} className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg overflow-hidden" style={{ backgroundColor: `${item.color}20` }}>
                    <Image
                      src={getDeviceImage(item.device)}
                      alt={item.device}
                      width={20}
                      height={20}
                      className="object-contain"
                      onError={(e) => {
                        // Fallback to colored icon if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden">
                      {item.device.toLowerCase().includes('mobile') || item.device.toLowerCase().includes('phone') ? (
                        <Smartphone className="h-5 w-5" style={{ color: item.color }} />
                      ) : item.device.toLowerCase().includes('tablet') ? (
                        <Tablet className="h-5 w-5" style={{ color: item.color }} />
                      ) : (
                        <Monitor className="h-5 w-5" style={{ color: item.color }} />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.device}</p>
                    <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{(item.visitors || 0).toLocaleString()}</p>
                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}