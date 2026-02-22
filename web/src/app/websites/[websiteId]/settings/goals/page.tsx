'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Plus,
  Trash2,
  MousePointer2,
  Eye,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';

export default function GoalConversionsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [goals] = useState([
    { id: 1, name: 'Signup Success', type: 'event', identifier: 'user_signup', count: 124, conversionRate: '3.2%' },
    { id: 2, name: 'Pricing Page Visit', type: 'pageview', identifier: '/pricing', count: 850, conversionRate: '12.5%' },
    { id: 3, name: 'Demo Requested', type: 'event', identifier: 'demo_request', count: 42, conversionRate: '1.1%' },
  ]);

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <DashboardPageHeader
        title="Goal Conversions"
        description="Define what success looks like for your website."
      >
        <Button size="sm" className="gap-1.5 text-xs font-medium">
          <Plus className="h-3.5 w-3.5" />
          Create Goal
        </Button>
      </DashboardPageHeader>

      {/* Goals Table */}
      <div className="border border-border/60 rounded-lg overflow-hidden bg-card shadow-sm">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_140px_100px_100px_60px] items-center px-5 py-2.5 border-b border-border/30 bg-muted/10 text-xs font-medium text-muted-foreground">
          <div className="pl-1">Goal</div>
          <div>Identifier</div>
          <div className="text-right">Total</div>
          <div className="text-right">Conv. Rate</div>
          <div />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/20">
          {goals.map((goal) => (
            <div key={goal.id} className="group grid grid-cols-[1fr_140px_100px_100px_60px] items-center px-5 py-3 transition-colors hover:bg-muted/20">
              {/* Goal */}
              <div className="flex items-center gap-3 min-w-0 pl-1">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  goal.type === 'event' ? "bg-indigo-500/10" : "bg-emerald-500/10"
                )}>
                  {goal.type === 'event' ? (
                    <MousePointer2 className="h-4 w-4 text-indigo-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{goal.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {goal.type === 'event' ? 'Custom Event' : 'Page Visit'}
                  </span>
                </div>
              </div>

              {/* Identifier */}
              <div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{goal.identifier}</code>
              </div>

              {/* Total */}
              <div className="text-right">
                <span className="text-sm font-medium">{goal.count.toLocaleString()}</span>
              </div>

              {/* Conv Rate */}
              <div className="text-right">
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{goal.conversionRate}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground/50 hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Event Tracking */}
      <Card className="border border-border/60 bg-card shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Custom Event Tracking</h3>
          <p className="text-xs text-muted-foreground mb-3">Track custom events directly from your frontend code.</p>
          <div className="bg-muted/30 border border-border/50 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm font-mono text-foreground leading-relaxed">
              <code>seentics.track(&apos;purchase_clicked&apos;, {'{ price: 99.00 }'})</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="bg-muted/30 border border-border/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Processing Time</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          New goals may take up to 5 minutes to appear in your dashboard after the first event is received.
        </p>
      </div>
    </div>
  );
}
