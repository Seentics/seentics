'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/stores/useAuthStore';
import { 
  Workflow, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowRight,
  Zap,
  Mail,
  Bell,
  Globe,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/analytics-api';
import Link from 'next/link';

const mockAutomations = [
  { id: 1, name: 'Welcome Email Sequence', type: 'Email', status: 'active', triggers: 12450, success: 98.2, icon: Mail, color: 'text-blue-500' },
  { id: 2, name: 'Slack Alerts: High Value', type: 'Notification', status: 'active', triggers: 450, success: 100, icon: Bell, color: 'text-orange-500' },
  { id: 3, name: 'Lead Score Sync', type: 'CRM', status: 'active', triggers: 2400, success: 99.5, icon: Database, color: 'text-emerald-500' },
  { id: 4, name: 'Abandoned Cart Recovery', type: 'Automation', status: 'active', triggers: 890, success: 94.8, icon: Zap, color: 'text-amber-500' },
  { id: 5, name: 'Webhook: Discord', type: 'Webhook', status: 'paused', triggers: 0, success: 0, icon: Globe, color: 'text-blue-600' },
];

export default function AutomationsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAutomations = mockAutomations.filter(auto => 
    auto.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Workflow Automations</h1>
          <p className="text-muted-foreground font-medium">Manage and monitor your automated intelligence workflows.</p>
        </div>
        <Link href="/settings/automations/builder">
            <Button variant="brand" className="h-12 px-6 font-black rounded-2xl gap-2 shadow-xl shadow-primary/20">
            <Plus className="h-5 w-5" />
            Create Automation
            </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-muted-foreground/10 bg-background/50 backdrop-blur-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-2">
                <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Total Triggers (30d)</CardDescription>
                <CardTitle className="text-3xl font-black">16,190</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-1 text-[11px] font-black text-green-500 bg-green-500/10 w-fit px-2 py-0.5 rounded-full">
                    <ArrowUpRight size={12} />
                    +24.5%
                </div>
            </CardContent>
         </Card>
         <Card className="border-muted-foreground/10 bg-background/50 backdrop-blur-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-2">
                <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Average Success Rate</CardDescription>
                <CardTitle className="text-3xl font-black text-blue-600">98.1%</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-1 text-[11px] font-black text-blue-500 bg-blue-500/10 w-fit px-2 py-0.5 rounded-full">
                    Stable
                </div>
            </CardContent>
         </Card>
         <Card className="border-muted-foreground/10 bg-background/50 backdrop-blur-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-2">
                <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Active Workflows</CardDescription>
                <CardTitle className="text-3xl font-black">4</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-1 text-[11px] font-black text-amber-500 bg-amber-500/10 w-fit px-2 py-0.5 rounded-full">
                    1 Paused
                </div>
            </CardContent>
         </Card>
      </div>

      {/* Search & Filter */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Search automations by name..." 
          className="pl-12 h-14 bg-muted/20 border-none shadow-none focus-visible:ring-1 text-sm font-medium rounded-2xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Automations Table */}
      <div className="border rounded-[2.5rem] overflow-hidden bg-background/50 backdrop-blur-sm border-muted-foreground/10 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 border-b border-muted-foreground/10">
              <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Automation</th>
              <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">30d Triggers</th>
              <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Success Rate</th>
              <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Status</th>
              <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-foreground/5">
            {filteredAutomations.map((auto) => (
              <tr key={auto.id} className="hover:bg-muted/5 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-border/50 flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                      <auto.icon className={`h-6 w-6 ${auto.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">{auto.name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{auto.type}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-center font-black text-base text-slate-900 dark:text-white">
                  {formatNumber(auto.triggers)}
                </td>
                <td className="px-8 py-6 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                     <span className={`text-sm font-black ${auto.success > 95 ? 'text-green-500' : 'text-amber-500'}`}>{auto.success}%</span>
                     <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${auto.success > 95 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${auto.success}%` }} />
                     </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                   <Badge variant={auto.status === 'active' ? 'outline' : 'secondary'} className={`rounded-lg font-black text-[10px] uppercase tracking-widest border-0 ${auto.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'}`}>
                    {auto.status}
                   </Badge>
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-9 px-4 text-[11px] font-black border border-border/50 rounded-xl hover:bg-muted">
                        ANALYTICS
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl hover:bg-muted">
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Promo Section */}
      <div className="bg-primary/5 rounded-[2.5rem] p-10 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-4 text-center md:text-left">
           <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto md:mx-0">
                <Workflow size={28} />
           </div>
           <h3 className="text-2xl font-black text-slate-900 dark:text-white">Unlock more power</h3>
           <p className="text-muted-foreground font-medium max-w-lg">
             Combine custom events with multiple actions for complex chaining. Seentics Automation is the ultimate growth tool for your intelligence engine.
           </p>
        </div>
        <Button variant="brand" className="h-14 px-10 rounded-2xl font-black text-base shadow-2xl shadow-primary/20">
            View Mastery Guide
        </Button>
      </div>
    </div>
  );
}
