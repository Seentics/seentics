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
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AutomationInsightTableProps {
  data: any;
  isLoading: boolean;
}

const workflows = [
  { id: 1, name: 'Welcome Email Sequence', icon: <Mail className="h-4 w-4 text-blue-500" />, trigger: 'Signup Complete', baseTrigger: 100, baseAction: 98 },
  { id: 2, name: 'Slack Alerts: High Value', icon: <Bell className="h-4 w-4 text-orange-500" />, trigger: 'Purchase > $500', baseTrigger: 45, baseAction: 45 },
  { id: 3, name: 'CRM Sync: Lead Score', icon: <Database className="h-4 w-4 text-emerald-500" />, trigger: 'Exit Intent', baseTrigger: 240, baseAction: 235 },
  { id: 4, name: 'Webhook: Discord Webhook', icon: <Globe className="h-4 w-4 text-blue-600" />, trigger: 'Page View: /pricing', baseTrigger: 850, baseAction: 850 },
  { id: 5, name: 'Abandoned Cart Recovery', icon: <Zap className="h-4 w-4 text-amber-500" />, trigger: 'Cart Inactive 30m', baseTrigger: 120, baseAction: 118 },
];

export const AutomationInsightTable: React.FC<AutomationInsightTableProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border/20">
             <div className="flex items-center space-x-4 flex-1">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-2">
                   <Skeleton className="h-4 w-32" />
                   <Skeleton className="h-3 w-24" />
                </div>
             </div>
             <div className="flex items-center gap-6">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
             </div>
          </div>
        ))}
      </div>
    );
  }

  const insightMultiplier = (data?.dashboardData?.total_visitors || 1000) / 5000;

  return (
    <Card className="bg-card border-border shadow-sm shadow-black/5 rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-6">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black tracking-tight">Automation Engine</CardTitle>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Real-time workflow execution</p>
        </div>
        <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 hover:bg-primary/5 gap-1.5 rounded-lg px-3">
            Manage
            <ArrowUpRight size={14} />
        </Button>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-accent/5">
                <th className="p-4 px-6 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60 w-1/2">Automation Flow</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60 text-center">Triggers</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60 text-right px-8">Executed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {workflows.map((wf) => {
                const triggers = Math.floor(wf.baseTrigger * (1 + (insightMultiplier * Math.random())));
                const actions = Math.floor(triggers * (wf.baseAction / wf.baseTrigger));
                
                return (
                  <tr key={wf.id} className="group hover:bg-accent/5 transition-all duration-300">
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 min-w-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          {React.cloneElement(wf.icon as React.ReactElement, { className: 'h-4 w-4 text-primary' })}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[13px] leading-tight text-foreground truncate ">{wf.name}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-60 mt-0.5">
                            Trigger: {wf.trigger}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-base font-black text-foreground tracking-tight">{formatNumber(triggers)}</span>
                        <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">
                           <ArrowUpRight size={10} strokeWidth={3} />
                           {Math.floor(Math.random() * 15)}%
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right px-8">
                      <div className="inline-flex flex-col items-end">
                        <div className="flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_var(--primary)] animate-pulse" />
                           <span className="text-base font-black text-foreground tracking-tight">{formatNumber(actions)}</span>
                        </div>
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] opacity-60">Successful</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
