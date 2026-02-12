'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, Users, Zap } from 'lucide-react';
import { formatNumber } from '@/lib/analytics-api';

interface AutomationAnalyticsProps {
  stats: {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    last30Days: number;
    last7Days?: number;
    todayCount?: number;
    uniqueVisitors?: number;
  };
}

export const AutomationAnalytics: React.FC<AutomationAnalyticsProps> = ({ stats }) => {
  const metrics = [
    {
      label: 'Total Executions',
      value: formatNumber(stats.totalExecutions || 0),
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Success Rate',
      value: `${(stats.successRate || 0).toFixed(1)}%`,
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Successful',
      value: formatNumber(stats.successCount || 0),
      icon: Zap,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Failed',
      value: formatNumber(stats.failureCount || 0),
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Last 30 Days',
      value: formatNumber(stats.last30Days || 0),
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Today',
      value: formatNumber(stats.todayCount || 0),
      icon: Clock,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.label} className="border-slate-800 bg-slate-900/40">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`h-10 w-10 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{metric.value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

interface ExecutionTimelineProps {
  executions: Array<{
    id: string;
    status: string;
    executedAt: string;
    completedAt?: string;
    errorMessage?: string;
    visitorId?: string;
  }>;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({ executions }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'running':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (!executions || executions.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/40">
        <CardContent className="p-8 text-center">
          <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No executions yet</p>
          <p className="text-sm text-slate-600 mt-1">This automation hasn't been triggered yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900/40">
      <CardHeader>
        <CardTitle className="text-white">Recent Executions</CardTitle>
        <CardDescription>Latest automation runs and their outcomes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {executions.slice(0, 10).map((execution) => (
            <div
              key={execution.id}
              className="flex items-center gap-4 p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition-colors"
            >
              <div className="flex-shrink-0">
                {getStatusIcon(execution.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-white capitalize">{execution.status}</p>
                  <p className="text-xs text-slate-500">{formatDate(execution.executedAt)}</p>
                </div>
                {execution.errorMessage && (
                  <p className="text-xs text-red-400 truncate">{execution.errorMessage}</p>
                )}
                {execution.visitorId && (
                  <p className="text-xs text-slate-600">Visitor: {execution.visitorId.slice(0, 8)}...</p>
                )}
              </div>
              <div className={`h-2 w-2 rounded-full ${getStatusColor(execution.status)}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
