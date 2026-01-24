'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Check, 
  Zap, 
  TrendingUp, 
  Clock, 
  ShieldCheck,
  Package
} from 'lucide-react';

export default function BillingSettings() {
  const currentPlan = {
    name: 'Pro',
    price: '$49/mo',
    usage: '840K / 1M',
    percentage: 84,
    status: 'Active'
  };

  const features = [
    'Up to 1,000,000 monthly events',
    'Unlimited websites',
    'Custom event tracking',
    'Team collaboration (up to 5 members)',
    '12 months data retention',
    'Priority support'
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-muted-foreground text-sm">Manage your subscription and track usage.</p>
        </div>
        <Button variant="outline" className="h-10 px-5 font-bold rounded-xl gap-2 hover:bg-muted">
          <CreditCard className="h-4 w-4" />
          Update Payment
        </Button>
      </div>

      {/* Current Plan Card */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-indigo-500/10 rounded-3xl blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative bg-card border rounded-3xl p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-black">{currentPlan.name} Plan</h2>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[10px] uppercase px-2 h-5">
                    {currentPlan.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-medium">{currentPlan.price}</p>
              </div>
            </div>
            
            <div className="text-left md:text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Billing Period</p>
              <p className="text-sm font-bold flex items-center md:justify-end gap-2">
                <Clock className="h-3.5 w-3.5" />
                Next invoice on Feb 24, 2026
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-dashed">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly Usage</span>
              <span className="text-xs font-black">{currentPlan.usage} events</span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${currentPlan.percentage}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic">You are at {currentPlan.percentage}% of your monthly limit.</p>
          </div>
        </div>
      </div>

      {/* Plan Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">Plan Features</h3>
          <ul className="space-y-3">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-emerald-600" />
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-muted/30 p-6 rounded-2xl border border-dashed space-y-4 flex flex-col justify-center">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shadow-sm">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-bold">Scaling fast?</p>
                <p className="text-xs text-muted-foreground">Upgrade to Enterprise for custom limits.</p>
              </div>
           </div>
           <Button variant="secondary" className="w-full h-10 font-bold rounded-xl active:scale-95 transition-transform">
              Contact Sales
           </Button>
        </div>
      </div>
    </div>
  );
}
