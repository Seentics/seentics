'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/analytics-api';
import { getBrowserImagePath } from '@/lib/analytics-icons';
import { Monitor } from 'lucide-react';
import Image from 'next/image';
import React from 'react';

interface TopBrowsersChartProps {
  data: any;
  isLoading: boolean;
  onViewMore?: () => void;
  showHeader?: boolean;
}

const BrowserIcon = ({ browser }: { browser: string }) => {
  const src = getBrowserImagePath(browser);
  if (src === '/images/browser/unknown.png') {
    return (
      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
        <Monitor className="w-4 h-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
      <Image src={src} alt={browser} width={32} height={32} className="object-contain" />
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
    return <Skeleton className="h-[400px] w-full" />;
  }

  const chartData = data?.top_browsers || [];
  const filteredData = chartData.filter((item: any) => (item.visitors || 0) > 0);
  const sortedData = [...filteredData].sort((a: any, b: any) => b.visitors - a.visitors).slice(0, 30);
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
    <div className="space-y-3 h-[400px] flex flex-col">
      {showHeader && (
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-foreground">Top Browsers</h3>
        </div>
      )}



      {/* Browsers List */}
      <div className="space-y-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {sortedData.map((item: any, index: number) => {
          const browserName = getBrowserName(item.browser);
          const percentage = ((item.visitors / totalVisitors) * 100).toFixed(1);

          return (
            <div key={index} className="flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-accent/5 transition-colors group px-1">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <BrowserIcon browser={item.browser} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors" title={browserName}>{browserName}</div>
                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-50 truncate" title={item.browser}>{item.browser}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-base leading-tight tracking-tight">{formatNumber(item.visitors)}</div>
                <div className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider opacity-50">{percentage}%</div>
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
                const colors = ['#4285F4', '#34A853', '#EA4335', '#FBBC05', '#2563EB', '#06B6D4', '#FF6B35'];
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
                const colors = ['#4285F4', '#34A853', '#EA4335', '#FBBC05', '#2563EB', '#06B6D4', '#FF6B35'];
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
                    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                      <p className="font-semibold">{data.name}</p>
                      <p className="text-indigo-600">{data.value}%</p>
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