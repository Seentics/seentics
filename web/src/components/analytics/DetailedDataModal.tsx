'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { formatNumber, formatDuration, formatPercentage } from '@/features/analytics/format';
import { TrafficChart } from './TrafficChart';
import { TopPagesChart } from '@/components/analytics/TopPagesChart';
import { TopSourcesChart } from '@/components/analytics/TopSourcesChart';
import { TopCountriesChart } from '@/components/analytics/TopCountriesChart';
import { TopDevicesChart } from '@/components/analytics/TopDevicesChart';
import { TopBrowsersChart } from '@/components/analytics/TopBrowsersChart';
import { useT, type Messages } from '@/lib/i18n';

interface DetailedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalType: string | null;
  data: any;
  isLoading: any;
}

const getModalTitle = (modalType: string, t: Messages['analytics']) => t.modal.titles[modalType] ?? t.modal.fallbackTitle;

const getModalContent = (modalType: string, data: any, isLoading: any, t: Messages['analytics']) => {
  const c = t.common;
  const metrics = data.dashboard || {};
  const legacyMetrics = metrics.metrics || {};
  const sessionCount = metrics.sessions ?? legacyMetrics.sessions ?? 0;
  
  switch (modalType) {
    case 'traffic':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{c.totalPageViews}</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{c.uniqueVisitors}</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(sessionCount)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{c.sessions}</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPercentage(metrics.bounce_rate || legacyMetrics.bounce_rate || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{c.bounceRate}</div>
            </div>
          </div>
          <TrafficChart data={data.dailyStats} isLoading={isLoading.dailyStats} />
        </div>
      );
    
    case 'pages':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.totalPageViews}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">{c.uniqueVisitors}</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.pages_per_session || legacyMetrics.pages_per_session || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.pagesPerSession}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">{c.avgTimeOnPage}</div>
            </div>
          </div>
          <TopPagesChart data={data.topPages} isLoading={isLoading.topPages} />
        </div>
      );
    
    case 'sources':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.totalVisitors}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.new_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">{c.newVisitors}</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.returning_visitors || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.returningVisitors}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatPercentage(metrics.bounce_rate || legacyMetrics.bounce_rate || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">{c.bounceRate}</div>
            </div>
          </div>
          <TopSourcesChart data={data.topReferrers} isLoading={isLoading.topReferrers} />
        </div>
      );
    
    case 'countries':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.totalVisitors}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">{c.totalPageViews}</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(sessionCount)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.sessions}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">{c.avgSessionTime}</div>
            </div>
          </div>
          <TopCountriesChart data={data.topCountries} isLoading={isLoading.topCountries} />
        </div>
      );
    
    case 'devices':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.totalVisitors}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">{c.totalPageViews}</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(sessionCount)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.sessions}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">{c.avgSessionTime}</div>
            </div>
          </div>
          <TopDevicesChart data={data.topDevices} isLoading={isLoading.topDevices} />
        </div>
      );
    
    case 'browsers':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.totalVisitors}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">{c.totalPageViews}</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(sessionCount)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.sessions}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatPercentage(metrics.bounce_rate || legacyMetrics.bounce_rate || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">{c.bounceRate}</div>
            </div>
          </div>
          <TopBrowsersChart data={data.topBrowsers} isLoading={isLoading.topBrowsers} />
        </div>
      );
    
    case 'visitors':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.totalVisitors}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.new_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">{c.newVisitors}</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.returning_visitors || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.returningVisitors}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(sessionCount)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">{c.sessions}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">{t.modal.visitorBreakdown}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{c.newVisitors}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(metrics.new_visitors || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{c.returningVisitors}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(metrics.returning_visitors || 0)}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{c.sessions}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(sessionCount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{c.avgSessionTime}</span>
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
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.page_views || legacyMetrics.page_views || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.totalPageViews}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(metrics.unique_visitors || legacyMetrics.unique_visitors || 0)}</div>
              <div className="text-sm text-green-700 dark:text-green-300 font-medium">{c.uniqueVisitors}</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{formatNumber(metrics.pages_per_session || legacyMetrics.pages_per_session || 0)}</div>
              <div className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{c.pagesPerSession}</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatDuration(metrics.session_duration || legacyMetrics.avg_session_time || 0)}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">{c.avgTimeOnPage}</div>
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
              <div className="text-sm text-gray-600 dark:text-gray-400">{c.avgTimeOnPage}</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.dashboard?.enhanced_metrics?.engagement_score || 0)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{c.engagementScore}</div>
            </div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.dashboard?.metrics?.avg_session_time || 0)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{c.avgSessionTime}</div>
          </div>
        </div>
      );
    
    case 'bounce':
      return (
        <div className="space-y-6">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPercentage(data.dashboard?.metrics?.bounce_rate || 0)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{c.bounceRate}</div>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(data.dashboard?.metrics?.sessions || 0)}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{c.totalSessions}</div>
          </div>
        </div>
      );
    
    default:
      return (
        <div className="space-y-6">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.modal.analyticsData}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{t.modal.selectMetric}</div>
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
  const t = useT().analytics;
  if (!modalType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">{getModalTitle(modalType, t)}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {getModalContent(modalType, data, isLoading, t)}
        </div>
      </DialogContent>
    </Dialog>
  );
}; 