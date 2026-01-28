'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/analytics-api';
import { Monitor } from 'lucide-react';
import Image from 'next/image';
import React from 'react';

interface TopBrowsersChartProps {
  data: any;
  isLoading: boolean;
  onViewMore?: () => void;
  showHeader?: boolean;
}

const getBrowserIcon = (browser: string) => {
  const lowerBrowser = browser.toLowerCase();

  // Chrome
  if (lowerBrowser.includes('chrome')) {
    return (
      <div className="w-8 h-8 rounded flex items-center justify-center shadow-sm overflow-hidden">
        <Image
          src="/images/chrome.png"
          alt="Chrome"
          width={32}
          height={32}
          className="object-contain"
          onError={(e) => {
            // Fallback to colored background if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden w-8 h-8 bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 rounded flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C8.21 0 4.67 1.92 2.25 4.9l4.51 7.8L12 12l5.24 0.7 4.51-7.8C19.33 1.92 15.79 0 12 0zM12 12l-5.24-0.7L2.25 19.1C4.67 22.08 8.21 24 12 24c3.79 0 7.33-1.92 9.75-4.9L17.24 11.3 12 12z" />
          </svg>
        </div>
      </div>
    );
  }

  // Firefox
  if (lowerBrowser.includes('firefox')) {
    return (
      <div className="w-8 h-8 rounded flex items-center justify-center shadow-sm overflow-hidden">
        <Image
          src="/images/firefox.png"
          alt="Firefox"
          width={32}
          height={32}
          className="object-contain"
          onError={(e) => {
            // Fallback to colored background if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.486 22 2 17.514 2 12S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10zm-1-6h2v2h-2v-2zm0-8h2v6h-2V8z" />
          </svg>
        </div>
      </div>
    );
  }

  // Safari
  if (lowerBrowser.includes('safari')) {
    return (
      <div className="w-8 h-8 rounded flex items-center justify-center shadow-sm overflow-hidden">
        <Image
          src="/images/safari.png"
          alt="Safari"
          width={32}
          height={32}
          className="object-contain"
          onError={(e) => {
            // Fallback to colored background if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
      </div>
    );
  }

  // Edge
  if (lowerBrowser.includes('edge')) {
    return (
      <div className="w-8 h-8 rounded flex items-center justify-center shadow-sm overflow-hidden">
        <Image
          src="/images/explorer.png"
          alt="Edge"
          width={32}
          height={32}
          className="object-contain"
          onError={(e) => {
            // Fallback to colored background if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
      </div>
    );
  }

  // Opera
  if (lowerBrowser.includes('opera')) {
    return (
      <div className="w-8 h-8 rounded flex items-center justify-center shadow-sm overflow-hidden">
        <Image
          src="/images/opera.png"
          alt="Opera"
          width={32}
          height={32}
          className="object-contain"
          onError={(e) => {
            // Fallback to colored background if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
      </div>
    );
  }

  // Default
  return (
    <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 rounded flex items-center justify-center shadow-sm">
      <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-300" />
    </div>
  );
};

const getBrowserName = (browser: string) => {
  const lowerBrowser = browser.toLowerCase();
  if (lowerBrowser.includes('chrome')) return 'Chrome';
  if (lowerBrowser.includes('firefox')) return 'Firefox';
  if (lowerBrowser.includes('safari')) return 'Safari';
  if (lowerBrowser.includes('edge')) return 'Edge';
  return browser;
};
export const TopBrowsersChart: React.FC<TopBrowsersChartProps> = ({ data, isLoading, showHeader = false }) => {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const chartData = data?.top_browsers || [];
  const filteredData = chartData.filter((item: any) => (item.visitors || 0) > 0);
  const sortedData = [...filteredData].sort((a: any, b: any) => b.visitors - a.visitors).slice(0, 7);
  const totalVisitors = sortedData.reduce((sum: number, item: any) => sum + item.visitors, 0);

  if (sortedData.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground py-12">
        <div className="text-center">
          <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium">No browser data available</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Browser data will appear here once visitors start browsing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Top Browsers</h3>
        </div>
      )}



      {/* Browsers List */}
      <div className="space-y-2">
        {sortedData.map((item: any, index: number) => {
          const browserName = getBrowserName(item.browser);
          const percentage = ((item.visitors / totalVisitors) * 100).toFixed(1);

          return (
            <div key={index} className="flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {getBrowserIcon(item.browser)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate text-gray-900 dark:text-gray-100" title={browserName}>{browserName}</div>
                  <div className="text-xs text-muted-foreground truncate" title={item.browser}>{item.browser}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{formatNumber(item.visitors)}</div>
                <div className="text-muted-foreground text-xs">{percentage}%</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Browser Distribution Chart */}
      {/* <div className="h-64 mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={sortedData.map((item: any, index: number) => {
                const percentage = ((item.views / totalViews) * 100).toFixed(1);
                const colors = ['#4285F4', '#34A853', '#EA4335', '#FBBC05', '#8B5CF6', '#06B6D4', '#FF6B35'];
                return {
                  name: getBrowserName(item.browser),
                  value: parseFloat(percentage),
                  color: colors[index % colors.length]
                };
              })}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {sortedData.map((item: any, index: number) => {
                const colors = ['#4285F4', '#34A853', '#EA4335', '#FBBC05', '#8B5CF6', '#06B6D4', '#FF6B35'];
                return (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                );
              })}
            </Pie>
            <Tooltip 
              content={({ active, payload }: any) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
                      <p className="font-semibold">{data.name}</p>
                      <p className="text-blue-600">{data.value}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div> */}
    </div>
  );
}; 