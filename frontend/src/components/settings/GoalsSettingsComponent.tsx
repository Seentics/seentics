'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Eye, 
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function GoalsSettingsComponent() {
  const [goals] = useState([
    { id: 1, name: 'Signup Success', type: 'event', identifier: 'user_signup', count: 124, conversionRate: '3.2%' },
    { id: 2, name: 'Pricing Page Visit', type: 'pageview', identifier: '/pricing', count: 850, conversionRate: '12.5%' },
    { id: 3, name: 'Demo Requested', type: 'event', identifier: 'demo_request', count: 42, conversionRate: '1.1%' },
  ]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Goal Conversions</h2>
          <p className="text-muted-foreground text-sm">Define what success looks like for your website.</p>
        </div>
        <Button className="h-10 px-5 font-bold rounded-xl gap-2 shadow-lg shadow-primary/20 transition-transform active:scale-95">
          <Plus className="h-4 w-4" />
          Create New Goal
        </Button>
      </div>

      {/* AI Assistant Banner */}
      <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">AI Conversion Optimizer</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              We've noticed a high drop-off on your <code className="bg-primary/10 px-1 rounded text-primary font-bold">/checkout</code> page. 
              Adding a goal for <code className="bg-primary/10 px-1 rounded text-primary font-bold">form_start</code> could help you identify exactly where users lose interest.
            </p>
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="grid grid-cols-1 gap-4">
        {goals.map((goal) => (
          <div 
            key={goal.id} 
            className="group bg-card/50 backdrop-blur-sm p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border/50 hover:border-primary/30 transition-all hover:bg-card/80"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 shadow-sm",
                goal.type === 'event' ? "bg-indigo-500/10 border-indigo-500/20" : "bg-emerald-500/10 border-emerald-500/20"
              )}>
                {goal.type === 'event' ? (
                  <MousePointer2 className="h-5 w-5 text-indigo-500" />
                ) : (
                  <Eye className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-bold text-foreground">{goal.name}</h3>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-1.5 h-4 bg-muted/50 border-muted-foreground/10">
                    {goal.type === 'event' ? 'Custom Event' : 'Page Visit'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="opacity-50">Identity:</span> {goal.identifier}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-8 sm:gap-12 ml-auto sm:ml-0">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5 opacity-60">Total</p>
                <p className="text-sm font-bold">{goal.count.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5 opacity-60">Rate</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-sm font-bold">{goal.conversionRate}</p>
                </div>
              </div>
              <div className="h-10 w-px bg-border/40 hidden sm:block mx-2" />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted transition-colors">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
        <Info className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground font-medium">
          New goals may take up to 5 minutes to appear in your dashboard after the first event is received.
        </p>
      </div>
    </div>
  );
}

const MousePointer2 = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M6 18l6-6"/></svg>;
