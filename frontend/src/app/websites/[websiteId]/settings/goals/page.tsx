'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  Target, 
  Plus, 
  Trash2, 
  MousePointer2, 
  Eye, 
  ChevronRight,
  Sparkles,
  Info,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function GoalConversionsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  
  const [goals, setGoals] = useState([
    { id: 1, name: 'Signup Success', type: 'event', identifier: 'user_signup', count: 124, conversionRate: '3.2%' },
    { id: 2, name: 'Pricing Page Visit', type: 'pageview', identifier: '/pricing', count: 850, conversionRate: '12.5%' },
    { id: 3, name: 'Demo Requested', type: 'event', identifier: 'demo_request', count: 42, conversionRate: '1.1%' },
  ]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Goal Conversions</h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase px-2 py-0">Beta</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Define what success looks like for your website.</p>
        </div>
        <Button className="h-10 px-5 font-bold rounded-xl gap-2 shadow-lg shadow-primary/20 hover-lift">
          <Plus className="h-4 w-4" />
          Create New Goal
        </Button>
      </div>

      {/* AI Assistant Banner */}
      <div className="glass p-6 rounded-2xl border-primary/10 relative overflow-hidden group">
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
              We've noticed a high drop-off on your <code className="bg-muted px-1 rounded text-primary">/checkout</code> page. 
              Adding a goal for <code className="bg-muted px-1 rounded text-primary">form_start</code> could help you identify exactly where users lose interest.
            </p>
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="grid grid-cols-1 gap-4">
        {goals.map((goal) => (
          <div 
            key={goal.id} 
            className="group glass-card p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
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
                  <h3 className="text-[15px] font-bold text-foreground">{goal.name}</h3>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-1.5 h-4 bg-muted/50 border-muted-foreground/10">
                    {goal.type === 'event' ? 'Custom Event' : 'Page Visit'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="opacity-50">Identity:</span> {goal.identifier}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-8 sm:gap-12 ml-auto sm:ml-0">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Total</p>
                <p className="text-sm font-bold">{goal.count.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Rate</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-sm font-bold">{goal.conversionRate}</p>
                </div>
              </div>
              <div className="h-10 w-px bg-border hidden sm:block mx-2" />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-rose-500/10 hover:text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Goal Creation Preview (Simplified for visual demo) */}
      <Card className="rounded-3xl border-dashed border-2 bg-muted/5">
        <CardHeader>
          <CardTitle className="text-sm font-bold">Quick Create Tip</CardTitle>
          <CardDescription className="text-xs">
            You can also track clicks on specific HTML IDs directly from your tracking code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-slate-300 border border-white/5">
            <span className="text-indigo-400">seentics</span>.<span className="text-emerald-400">track</span>(<span className="text-amber-400">'purchase_clicked'</span>, &#123; <span className="text-slate-500">price: 99.00</span> &#125;);
          </div>
        </CardContent>
      </Card>
      
      {/* Help Section */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
        <Info className="h-5 w-5 text-blue-500 shrink-0" />
        <p className="text-xs text-blue-600/80 font-medium">
          New goals may take up to 5 minutes to appear in your dashboard after the first event is received.
        </p>
      </div>
    </div>
  );
}

