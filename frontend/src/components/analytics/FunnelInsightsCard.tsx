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
      <div className="space-y-4 dark:bg-gray-800 rounded-md">
        {[...Array(4)].map((_, i) => (
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

  return (
    <Card className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Funnel Performance</CardTitle>
          <CardDescription className="text-xs">Conversion rates and drop-offs</CardDescription>
        </div>
        <Link href="/settings/funnels" className="text-xs font-black text-primary flex items-center gap-1 hover:underline">
            View All
            <ArrowUpRight size={14} />
        </Link>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground w-2/5">Funnel</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-center">Conv. Rate</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right">Main Drop-off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockFunnels.map((funnel) => (
                <tr key={funnel.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 min-w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 transition-colors">
                        <Filter size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate text-foreground">{funnel.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-medium text-muted-foreground">
                                {funnel.steps} Steps
                            </span>
                            {funnel.trend === 'up' && <TrendingUp size={10} className="text-emerald-500" />}
                            {funnel.trend === 'down' && <TrendingDown size={10} className="text-rose-500" />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-sm font-black ${funnel.conversion > 50 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                        {funnel.conversion}%
                      </span>
                      <div className="h-1.5 w-16 bg-muted/50 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${funnel.conversion > 50 ? 'bg-emerald-500' : 'bg-primary'}`} 
                            style={{ width: `${funnel.conversion}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                        <ArrowRight size={10} />
                        {funnel.dropoff}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Bottleneck</span>
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
