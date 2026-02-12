
'use client';
import { useDashboardData } from '@/lib/analytics-api';
import { getWorkflows, type Workflow } from '@/lib/workflow-api';
import { useAuth } from '@/stores/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import { Activity, CircleCheckBig, Eye, Target, Users, Workflow as WorkflowIcon } from 'lucide-react';

interface DashboardStatsProps {
  siteId: string | null;
}

export function DashboardStats({ siteId }: DashboardStatsProps) {
  const { user } = useAuth();

  // Fetch analytics data if siteId is provided
  const { data: dashboardData } = useDashboardData(siteId || '', 7);


  const { data: workflowsData, isLoading } = useQuery<Workflow[]>({
    queryKey: ['workflows', user?._id, siteId],
    queryFn: () => getWorkflows(siteId as string),
    enabled: !!user && !!siteId,
  });

  // Ensure workflows is always an array
  const workflows = Array.isArray(workflowsData) ? workflowsData :
    (workflowsData as any)?.workflows ? (workflowsData as any).workflows :
      (workflowsData as any)?.data ? (workflowsData as any).data :
        [];

  const activeWorkflows = Array.isArray(workflows) ? workflows.filter(w => w.status === 'Active').length : 0;
  const totalTriggers = Array.isArray(workflows) ? workflows.reduce((sum, w) => sum + (w.analytics?.totalTriggers || 0), 0) : 0;
  const totalCompletions = Array.isArray(workflows) ? workflows.reduce((sum, w) => sum + (w.analytics?.totalCompletions || 0), 0) : 0;
  const rawAvgCompletionRate = totalCompletions > 0 && totalTriggers > 0 ? (totalCompletions / totalTriggers) * 100 : 0;
  const avgCompletionRate = Math.min(100, rawAvgCompletionRate);

  const stats = [
    {
      title: 'Total Visitors',
      value: dashboardData?.unique_visitors || 0,
      icon: Users,
      change: dashboardData?.comparison?.visitor_change !== undefined && dashboardData.comparison.visitor_change !== null ?
        dashboardData.comparison.visitor_change === 0 ? 'New' :
          `${dashboardData.comparison.visitor_change > 0 ? '+' : ''}${dashboardData.comparison.visitor_change.toFixed(1)}%` :
        'No change data',
    },
    {
      title: 'Page Views',
      value: dashboardData?.page_views || 0,
      icon: Eye,
      change: dashboardData?.comparison?.pageview_change !== undefined && dashboardData.comparison.pageview_change !== null ?
        dashboardData.comparison.pageview_change === 0 ? 'New' :
          `${dashboardData.comparison.pageview_change > 0 ? '+' : ''}${dashboardData.comparison.pageview_change.toFixed(1)}%` :
        'No change data',
    },
    {
      title: 'Total Workflows',
      value: Array.isArray(workflows) ? workflows.length.toString() : '0',
      icon: WorkflowIcon,
      change: '+2 since last month',
    },
    {
      title: 'Active Workflows',
      value: activeWorkflows.toString(),
      icon: Activity,
      change: Array.isArray(workflows) && workflows.length > 0 ? `${Math.round((activeWorkflows / workflows.length) * 100)}% of total` : 'N/A',
    },
    {
      title: 'Total Triggers',
      value: totalTriggers > 1000 ? `${(totalTriggers / 1000).toFixed(1)}k` : totalTriggers.toString(),
      icon: Target,
      change: '+15.2% this week',
    },
    {
      title: 'Avg. Completion',
      value: `${avgCompletionRate.toFixed(1)}%`,
      icon: CircleCheckBig,
      change: '—',
    },
  ];

  if (isLoading) {
    return (
      <div className=" rounded shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-200 dark:divide-slate-700">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="p-6">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!siteId) {
    return (
      <div className="rounded border-none dark:border dark:border-slate-700 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-slate-200 dark:divide-slate-700">
          {stats.map((stat, index) => (
            <div key={index} className="p-6">
              <div className="flex items-center justify-between pb-2.5">
                <div className="text-sm font-semibold text-foreground/90">{stat.title}</div>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <div className="text-2xl font-bold text-foreground">-</div>
                <p className="text-xs text-muted-foreground">Select a site to view stats</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }



  return (
    <div className="bg-white dark:bg-transparent dark:border dark:border-slate-700 shadow-md">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 divide-x divide-slate-200 dark:divide-slate-700">
        {stats.map((stat, index) => (
          <div key={stat.title} className="group cursor-default hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between pb-2 sm:pb-2.5">
              <div className="text-xs sm:text-sm font-semibold text-foreground/90 truncate pr-1 sm:pr-2">{stat.title}</div>
              <stat.icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground group-hover:text-foreground/70 transition-colors flex-shrink-0" />
            </div>
            <div className="space-y-1 sm:space-y-1.5">
              <div className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight text-foreground group-hover:text-foreground/90 transition-colors">
                {stat.value}
              </div>
              {stat.change && (
                <div className="text-xs text-muted-foreground font-medium">
                  {stat.change}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
