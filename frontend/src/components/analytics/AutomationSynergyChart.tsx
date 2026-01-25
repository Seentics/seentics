'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Workflow, 
  Zap, 
  ArrowUpRight, 
  Mail, 
  Bell, 
  Globe, 
  Database,
  ArrowRight
} from 'lucide-react';
import { formatNumber } from '@/lib/analytics-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface AutomationInsightTableProps {
  data: any;
  isLoading: boolean;
}

const workflows = [
  { id: 1, name: 'Welcome Email Sequence', icon: <Mail className="h-4 w-4 text-blue-500" />, trigger: 'Signup Complete', baseTrigger: 100, baseAction: 98 },
  { id: 2, name: 'Slack Alerts: High Value', icon: <Bell className="h-4 w-4 text-orange-500" />, trigger: 'Purchase > $500', baseTrigger: 45, baseAction: 45 },
  { id: 3, name: 'CRM Sync: Lead Score', icon: <Database className="h-4 w-4 text-emerald-500" />, trigger: 'Exit Intent', baseTrigger: 240, baseAction: 235 },
  { id: 4, name: 'Webhook: Discord Webhook', icon: <Globe className="h-4 w-4 text-indigo-500" />, trigger: 'Page View: /pricing', baseTrigger: 850, baseAction: 850 },
  { id: 5, name: 'Abandoned Cart Recovery', icon: <Zap className="h-4 w-4 text-amber-500" />, trigger: 'Cart Inactive 30m', baseTrigger: 120, baseAction: 118 },
];

export const AutomationInsightTable: React.FC<AutomationInsightTableProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-4 dark:bg-gray-800">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse text-muted">
             <div className="flex items-center space-x-4 flex-1">
                <div className="w-10 h-10 bg-muted rounded-xl" />
                <div className="space-y-2">
                   <div className="h-4 w-32 bg-muted rounded" />
                   <div className="h-3 w-20 bg-muted rounded" />
                </div>
             </div>
             <div className="h-8 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Generate some semi-random numbers based on traffic data for demo
  const insightMultiplier = (data?.dashboardData?.total_visitors || 1000) / 5000;

  return (
    <Card className="col-span-full shadow-lg border-primary/10 rounded-md overflow-hidden dark:bg-gray-800">
      <CardHeader className="flex flex-row items-center justify-between border-b  pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Workflow Automation Insights</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-black border-primary text-primary bg-primary/5">PRO</Badge>
          </div>
          <CardDescription className="text-xs">Real-time automation status triggered by site behavior</CardDescription>
        </div>
        <button className="text-xs font-black text-primary flex items-center gap-1 hover:underline">
            Manage All
            <ArrowUpRight size={14} />
        </button>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground w-1/2">Automation Name</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center">Triggers</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right px-6">Actions Executed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workflows.map((wf) => {
                const triggers = Math.floor(wf.baseTrigger * (1 + (insightMultiplier * Math.random())));
                const actions = Math.floor(triggers * (wf.baseAction / wf.baseTrigger));
                
                return (
                  <tr key={wf.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 min-w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          {wf.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate text-slate-900 dark:text-white">{wf.name}</p>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                            IF {wf.trigger}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-base font-black text-slate-900 dark:text-white">{formatNumber(triggers)}</span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-green-500">
                           <ArrowUpRight size={10} />
                           +{Math.floor(Math.random() * 15)}%
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right px-6">
                      <div className="inline-flex flex-col items-end">
                        <div className="flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                           <span className="text-base font-black text-slate-900 dark:text-white">{formatNumber(actions)}</span>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Successful</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-primary/5 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Workflow size={16} />
              </div>
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 max-w-xs leading-tight">
                Connect your analytics to 2,000+ apps with Seentics Automation.
              </p>
           </div>
           <Link href="https://automation.seentics.com" target="_blank">
            <Button variant="brand" size="sm" className="h-10 text-[11px] font-black uppercase tracking-widest px-6 shadow-lg shadow-primary/20">
                GO TO AUTOMATION
                <ArrowRight size={14} className="ml-2" />
            </Button>
           </Link>
        </div>
      </CardContent>
    </Card>
  );
};
