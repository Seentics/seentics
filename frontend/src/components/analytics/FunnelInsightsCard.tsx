'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Filter, 
  ArrowUpRight, 
  TrendingDown,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface FunnelInsightsCardProps {
  data?: any;
  isLoading: boolean;
}

const mockFunnels = [
  { id: 1, name: 'SaaS Signup Flow', steps: 4, conversion: 12.5, dropoff: 'Pricing Page', visitors: 15400, trend: 'up' },
  { id: 2, name: 'Checkout Conversion', steps: 3, conversion: 68.2, dropoff: 'Shipping Info', visitors: 2800, trend: 'stable' },
  { id: 3, name: 'Help Documentation', steps: 2, conversion: 45.1, dropoff: 'Article View', visitors: 8900, trend: 'down' },
  { id: 4, name: 'Lead Magnet Download', steps: 2, conversion: 22.8, dropoff: 'Opt-in Form', visitors: 4200, trend: 'up' },
];

export const FunnelInsightsCard: React.FC<FunnelInsightsCardProps> = ({ isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border/20">
             <div className="flex items-center space-x-4 flex-1">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="space-y-2">
                   <Skeleton className="h-4 w-32" />
                   <Skeleton className="h-3 w-24" />
                </div>
             </div>
             <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="bg-card border-border shadow-sm shadow-black/5 rounded-xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-6">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black tracking-tight">Conversion Funnels</CardTitle>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Conversion rates & drop-off analysis</p>
        </div>
        <Link href="/settings/funnels">
            <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 hover:bg-primary/5 gap-1.5 rounded-md px-3">
                All Funnels
                <ArrowUpRight size={14} />
            </Button>
        </Link>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-accent/5">
                <th className="p-4 px-6 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60 w-2/5">Funnel Path</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60 text-center">Efficiency</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground opacity-60 text-right px-8">Critical Drop-off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {mockFunnels.map((funnel) => (
                <tr key={funnel.id} className="group hover:bg-accent/5 transition-all duration-300">
                  <td className="p-4 px-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 min-w-10 rounded-lg bg-accent/10 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                        <Filter size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[13px] leading-tight text-foreground truncate ">{funnel.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
                                {funnel.steps} Steps
                            </span>
                            {funnel.trend === 'up' && <TrendingUp size={10} strokeWidth={3} className="text-emerald-500" />}
                            {funnel.trend === 'down' && <TrendingDown size={10} strokeWidth={3} className="text-rose-500" />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={cn(
                        "text-sm font-black tracking-tight",
                        funnel.conversion > 50 ? 'text-emerald-500' : 'text-foreground'
                      )}>
                        {funnel.conversion}%
                      </span>
                      <div className="h-1.5 w-16 bg-accent/10 rounded-full overflow-hidden shrink-0">
                        <div 
                            className={cn(
                                "h-full rounded-full transition-all duration-300",
                                funnel.conversion > 50 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-primary shadow-[0_0_8px_var(--primary)]'
                            )}
                            style={{ width: `${funnel.conversion}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right px-8">
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-md">
                        <ArrowRight size={10} strokeWidth={3} />
                        {funnel.dropoff}
                      </span>
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] opacity-60 mt-1">Primary Bottleneck</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
