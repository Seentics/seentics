'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber, formatDuration, formatPercentage } from '@/lib/analytics-api';
import { TrafficChart } from './TrafficChart';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TopCountriesChart } from '@/components/analytics/TopCountriesChart';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { TopBrowsersChart } from '@/components/analytics/TopBrowsersChart';

interface DetailedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalType: string | null;
  data: any;
  isLoading: any;
}

const getModalTitle = (modalType: string) => {
  switch (modalType) {
    case 'traffic':
      return 'Traffic Overview';
    case 'pages':
      return 'Top Pages';
    case 'sources':
      return 'Top Sources';
    case 'countries':
      return 'Top Countries';
    case 'devices':
      return 'Top Devices';
    case 'browsers':
      return 'Top Browsers';
    case 'visitors':
      return 'Visitor Analytics';
    case 'pageviews':
      return 'Page View Analytics';
    case 'engagement':
      return 'Engagement Analytics';
    case 'bounce':
      return 'Bounce Rate Analytics';
    default:
      return 'Detailed Analytics';
  }
};

const getModalContent = (modalType: string, data: any, isLoading: any) => {
  const metrics = data.dashboard || {};
  const legacyMetrics = metrics.metrics || {};
  
  switch (modalType) {
    case 'traffic':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Page Views</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Unique Visitors</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(metrics.total_visitors || legacyMetrics.sessions || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Visits</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPercentage(metrics.bounce_rate || legacyMetrics.bounce_rate || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Bounce Rate</div>
            </div>
          </div>
          <TrafficChart data={data.dailyStats} isLoading={isLoading.dailyStats} />
        </div>
      );
    
    case 'pages':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Page Views</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">Unique Visitors</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(metrics.pages_per_session || legacyMetrics.pages_per_session || 0)}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Pages per Session</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Avg Time on Page</div>
            </div>
          </div>
          <TopPagesChart data={data.topPages} isLoading={isLoading.topPages} />
        </div>
      );
    
    case 'sources':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Visitors</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.new_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">New Visitors</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(metrics.returning_visitors || 0)}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Returning Visitors</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatPercentage(metrics.bounce_rate || legacyMetrics.bounce_rate || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Bounce Rate</div>
            </div>
          </div>
          <TopSourcesChart data={data.topReferrers} isLoading={isLoading.topReferrers} />
        </div>
      );
    
    case 'countries':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Visitors</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">Total Page Views</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(metrics.total_visitors || legacyMetrics.sessions || 0)}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Total Sessions</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Avg Session Time</div>
            </div>
          </div>
          <TopCountriesChart data={data.topCountries} isLoading={isLoading.topCountries} />
        </div>
      );
    
    case 'devices':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Visitors</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">Total Page Views</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(metrics.total_visitors || legacyMetrics.sessions || 0)}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Total Sessions</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Avg Session Time</div>
            </div>
          </div>
          <TopDevicesChart data={data.topDevices} isLoading={isLoading.topDevices} />
        </div>
      );
    
    case 'browsers':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Visitors</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">Total Page Views</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(metrics.total_visitors || legacyMetrics.sessions || 0)}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Total Sessions</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatPercentage(metrics.bounce_rate || legacyMetrics.bounce_rate || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Bounce Rate</div>
            </div>
          </div>
          <TopBrowsersChart data={data.topBrowsers} isLoading={isLoading.topBrowsers} />
        </div>
      );
    
    case 'visitors':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Visitors</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.new_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">New Visitors</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(metrics.returning_visitors || 0)}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Returning Visitors</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(metrics.total_visitors || legacyMetrics.sessions || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Total Sessions</div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Visitor Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">New Visitors</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(metrics.new_visitors || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Returning Visitors</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(metrics.returning_visitors || 0)}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(metrics.total_visitors || legacyMetrics.sessions || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Avg Session Time</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    
    case 'pageviews':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total Page Views</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">Unique Visitors</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(metrics.pages_per_session || legacyMetrics.pages_per_session || 0)}</div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">Pages per Session</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">Avg Time on Page</div>
            </div>
          </div>
          <TopPagesChart data={data.topPages} isLoading={isLoading.topPages} />
        </div>
      );
    
    case 'engagement':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDuration(data.dashboard?.enhanced_metrics?.avg_time_on_page || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Time on Page</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.dashboard?.enhanced_metrics?.engagement_score || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Engagement Score</div>
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.dashboard?.metrics?.avg_session_time || 0)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Avg Session Time</div>
          </div>
        </div>
      );
    
    case 'bounce':
      return (
        <div className="space-y-6">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPercentage(data.dashboard?.metrics?.bounce_rate || 0)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Bounce Rate</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.dashboard?.metrics?.sessions || 0)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</div>
          </div>
        </div>
      );
    
    default:
      return (
        <div className="space-y-6">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics Data</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Select a specific metric to view detailed data</div>
          </div>
        </div>
      );
  }
};

export const DetailedDataModal: React.FC<DetailedDataModalProps> = ({ 
  isOpen, 
  onClose, 
  modalType, 
  data, 
  isLoading 
}) => {
  if (!modalType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">{getModalTitle(modalType)}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {getModalContent(modalType, data, isLoading)}
        </div>
      </DialogContent>
    </Dialog>
  );
}; 