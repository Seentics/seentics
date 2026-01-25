'use client';

import React, { useState } from 'react';
import { 
  Filter, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowRight,
  TrendingUp,
  MousePointer2,
  ListRestart,
  BarChart3,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

const mockFunnels = [
  { id: 1, name: 'SaaS Signup Flow', steps: 4, conversion: 12.5, dropoff: 'Pricing Page', visitors: 15400, color: 'text-blue-600' },
  { id: 2, name: 'Checkout Conversion', steps: 3, conversion: 68.2, dropoff: 'Shipping Info', visitors: 2800, color: 'text-emerald-600' },
  { id: 3, name: 'Help Documentation', steps: 2, conversion: 45.1, dropoff: 'Article View', visitors: 8900, color: 'text-amber-600' },
  { id: 4, name: 'Lead Magnet Download', steps: 2, conversion: 22.8, dropoff: 'Opt-in Form', visitors: 4200, color: 'text-rose-600' },
];

export default function FunnelsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFunnels = mockFunnels.filter(funnel => 
    funnel.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Conversion Funnels</h1>
          <p className="text-muted-foreground font-medium">Track and optimize multi-step user journeys.</p>
        </div>
        <Link href="/settings/funnels/builder">
            <Button variant="brand" className="h-12 px-6 font-black rounded-2xl gap-2 shadow-xl shadow-primary/20">
            <Plus className="h-5 w-5" />
            Create Funnel
            </Button>
        </Link>
      </div>

      {/* Funnel Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {mockFunnels.slice(0, 4).map((funnel) => (
             <Card key={funnel.id} className="border-muted-foreground/10 bg-background/50 backdrop-blur-sm rounded-[2.2rem] hover:shadow-xl transition-all group p-2">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center ${funnel.color} group-hover:scale-110 transition-transform`}>
                            <Filter size={24} />
                        </div>
                        <Badge variant="secondary" className="bg-primary/5 text-primary border-0 font-black text-[10px] py-1 px-3">
                            {funnel.conversion}% CVR
                        </Badge>
                    </div>
                    <CardTitle className="text-lg font-black text-slate-900 dark:text-white">{funnel.name}</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest">{funnel.steps} STEPS JOURNEY</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground">
                            <span>Main Bottleneck:</span>
                            <span className="text-rose-500">{funnel.dropoff}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                           <div className="h-full bg-primary" style={{ width: `${funnel.conversion}%` }} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-muted-foreground/5">
                        <div className="flex items-center gap-2">
                            <Users size={14} className="text-muted-foreground" />
                            <span className="text-xs font-black">{funnel.visitors.toLocaleString()}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                            <ArrowRight size={16} />
                        </Button>
                    </div>
                </CardContent>
             </Card>
         ))}
      </div>

      {/* Detailed Funnel Management */}
      <div className="space-y-6">
          <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Active Funnel Audit</h2>
              <div className="relative group w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
                <Input 
                  placeholder="Find funnel..." 
                  className="pl-10 h-10 bg-muted/20 border-none shadow-none rounded-xl text-xs font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
          </div>

          <div className="border rounded-[2.5rem] overflow-hidden bg-background/50 backdrop-blur-sm border-muted-foreground/10 shadow-inner">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-muted-foreground/10">
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Funnel Name</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Entry Traffic</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Conversion</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Deep Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-foreground/5">
                {filteredFunnels.map((funnel) => (
                  <tr key={funnel.id} className="hover:bg-muted/5 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-slate-600 dark:text-slate-400">
                           <BarChart3 size={16} />
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{funnel.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center text-sm font-bold text-muted-foreground">
                        {funnel.visitors.toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-center">
                        <Badge variant="outline" className="rounded-lg font-black border-emerald-500/20 text-emerald-500 bg-emerald-500/5">
                           {funnel.conversion}%
                        </Badge>
                    </td>
                    <td className="px-8 py-6">
                        <div className="flex justify-end">
                            <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-border font-bold text-[10px] uppercase tracking-wider gap-2">
                                <TrendingUp size={14} />
                                View Breakdown
                            </Button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      {/* Advanced Module Teaser */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="bg-slate-900 dark:bg-slate-950 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:bg-primary/20 transition-all duration-1000" />
              <h4 className="text-white text-xl font-black mb-4 relative z-10">Heatmaps Synergy</h4>
              <p className="text-slate-400 text-sm font-medium mb-6 relative z-10 leading-relaxed">
                  Deeply analyze drop-offs by overlaying heatmaps on funnel steps. See exactly where they clicked before leaving.
              </p>
              <Button size="sm" variant="brand" className="rounded-xl font-black text-[11px] uppercase tracking-widest relative z-10">
                  Enable Heatmaps
              </Button>
          </div>
          <div className="bg-blue-600 p-8 rounded-[2.5rem] border border-blue-500/20 relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -ml-20 -mb-20 group-hover:bg-white/20 transition-all duration-1000" />
              <h4 className="text-white text-xl font-black mb-4 relative z-10">AI Optimization</h4>
              <p className="text-blue-100 text-sm font-medium mb-6 relative z-10 leading-relaxed">
                  Let Seentics AI suggest funnel optimizations based on user behavior patterns and A/B test results.
              </p>
              <Button size="sm" variant="secondary" className="rounded-xl font-black text-[11px] uppercase tracking-widest relative z-10 bg-white text-blue-600 border-0 hover:bg-white/90 shadow-2xl">
                  Try AI Beta
              </Button>
          </div>
      </div>
    </div>
  );
}
