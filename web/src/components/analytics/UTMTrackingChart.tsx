'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, TrendingUp, Users, ChevronRight, Globe, Mail, Share2 } from 'lucide-react';

interface UTMTrackingChartProps {
  data: any;
  isLoading: boolean;
  onViewMore: (type: string) => void;
}

export const UTMTrackingChart: React.FC<UTMTrackingChartProps> = ({ data, isLoading, onViewMore }) => {
  const utmPerformance = data?.utm_performance || {};
  const sources = utmPerformance.sources || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getSourceIcon = (source: string) => {
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('google')) return <Globe className="h-4 w-4 text-blue-500" />;
    if (lowerSource.includes('facebook')) return <Share2 className="h-4 w-4 text-blue-600" />;
    if (lowerSource.includes('email')) return <Mail className="h-4 w-4 text-green-500" />;
    if (lowerSource.includes('twitter')) return <TrendingUp className="h-4 w-4 text-blue-400" />;
    return <ExternalLink className="h-4 w-4 text-gray-500" />;
  };

  const getSourceName = (source: string) => {
    if (!source || source === '') return 'Direct';
    return source.charAt(0).toUpperCase() + source.slice(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">UTM Sources</h3>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onViewMore('utm')}
        >
          View All
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {sources.length > 0 ? (
        <div className="space-y-3">
          {sources.slice(0, 5).map((source: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-center gap-3">
                {getSourceIcon(source.source)}
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {getSourceName(source.source)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {source.visits} visits
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {source.unique_visitors}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  unique visitors
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <ExternalLink className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm">No UTM tracking data available</p>
          <p className="text-xs mt-1">Add UTM parameters to your links to track campaign performance</p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">UTM Tracking Tips</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Use consistent UTM parameters across campaigns</li>
            <li>• Track source, medium, and campaign for each link</li>
            <li>• Monitor which sources drive the most engaged visitors</li>
          </ul>
        </div>
      )}
    </div>
  );
}; 