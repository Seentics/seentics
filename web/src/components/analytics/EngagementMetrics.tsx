'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, Clock, MousePointer, Target, Activity, ChevronRight } from 'lucide-react';

interface EngagementMetricsProps {
  data: any;
  isLoading: boolean;
  onViewMore: (type: string) => void;
}

export const EngagementMetrics: React.FC<EngagementMetricsProps> = ({ data, isLoading, onViewMore }) => {
  const engagementMetrics = data?.engagement_metrics || {};
  const enhancedMetrics = data?.enhanced_metrics || {};

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card shadow-sm">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const engagementScore = enhancedMetrics.engagement_score || 0;
  const avgScrollDepth = engagementMetrics.avg_scroll_depth || 0;
  const exitIntents = engagementMetrics.exit_intents || 0;
  const engagedUsers = engagementMetrics.engaged_users || 0;
  const totalEvents = engagementMetrics.total_events || 0;
  const engagementRate = engagementMetrics.engagement_rate || 0;
  const newVisitors = enhancedMetrics.new_visitors || 0;
  const returningVisitors = enhancedMetrics.returning_visitors || 0;

  return (
    <div className="space-y-6">
      {/* Engagement Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">Engagement Score</CardTitle>
            <Target className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(engagementScore)}</div>
            <Progress value={engagementScore} className="mt-2" />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Out of 100</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">Avg Scroll Depth</CardTitle>
            <MousePointer className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(avgScrollDepth)}%</div>
            <Progress value={avgScrollDepth} className="mt-2" />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Page engagement</p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">Engaged Users</CardTitle>
            <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{engagedUsers}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {engagementRate > 0 ? `${Math.round(engagementRate)}%` : '0%'} engagement rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">Exit Intents</CardTitle>
            <Activity className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{exitIntents}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Detected attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* Visitor Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Visitor Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">New Visitors</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{newVisitors}</span>
                <Badge variant="secondary" className="text-xs">
                  {totalEvents > 0 ? Math.round((newVisitors / totalEvents) * 100) : 0}%
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Returning Visitors</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{returningVisitors}</span>
                <Badge variant="secondary" className="text-xs">
                  {totalEvents > 0 ? Math.round((returningVisitors / totalEvents) * 100) : 0}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Engagement Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Events</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{totalEvents}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Engagement Rate</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {engagementRate > 0 ? `${Math.round(engagementRate)}%` : '0%'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Avg Session Time</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {enhancedMetrics.avg_time_on_page ? `${Math.round(enhancedMetrics.avg_time_on_page)}s` : '0s'}
                </span>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => onViewMore('engagement')}
            >
              View Detailed Engagement
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 