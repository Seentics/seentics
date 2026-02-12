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
  Package,
  Loader2
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

export default function BillingSettings() {
  const { subscription, loading, getUsagePercentage } = useSubscription();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Subscription...</p>
      </div>
    );
  }

  const currentPlan = {
    name: subscription?.plan || 'Free',
    price: subscription?.plan === 'free' ? '$0' : (subscription?.plan === 'pro_plus' ? '$99/mo' : (subscription?.plan === 'growth' ? '$29/mo' : '$0')),
    usage: `${subscription?.usage.monthlyEvents.current.toLocaleString()} / ${subscription?.usage.monthlyEvents.limit === -1 ? '∞' : ((subscription?.usage.monthlyEvents.limit || 0) / 1000) + 'K'}`,
    percentage: getUsagePercentage('monthlyEvents'),
    status: 'Active'
  };

  const features = subscription?.features || [
    'Up to 10,000 monthly events',
    '1 website limit',
    'Standard analytics',
    'Community support'
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Billing & Plans</h1>
          <p className="text-muted-foreground font-medium">Manage your subscription and track usage.</p>
        </div>
        <Button variant="outline" className="h-10 px-5 font-bold rounded gap-2 hover:bg-muted border-2">
          <CreditCard className="h-4 w-4" />
          Update Payment
        </Button>
      </div>

      {/* Current Plan Card */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-indigo-500/10 rounded-xl blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative bg-card border-2 rounded-xl p-8 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-black uppercase tracking-tight">{currentPlan.name} Plan</h2>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[10px] uppercase px-2 h-5">
                    {currentPlan.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-bold">{currentPlan.price}</p>
              </div>
            </div>
            
            <div className="text-left md:text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Billing Period</p>
              <p className="text-sm font-bold flex items-center md:justify-end gap-2">
                <Clock className="h-3.5 w-3.5" />
                Next invoice on {new Date(Date.now() + 86400000 * 30).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-8 border-t-2 border-dashed">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monthly Usage</span>
              <span className="text-sm font-black">{currentPlan.usage} EVENTS</span>
            </div>
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden border shadow-inner">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-sm"
                style={{ width: `${currentPlan.percentage}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <p className="text-muted-foreground font-bold italic">You are at {currentPlan.percentage}% of your monthly limit.</p>
              <p className="font-black text-primary uppercase">Automated Calibration Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Plan Features</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm font-bold p-3 rounded-lg bg-card border hover:border-primary/50 transition-colors">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="uppercase text-[11px] tracking-tight">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-900 dark:bg-slate-900 p-8 rounded-xl border-2 border-primary/20 space-y-6 flex flex-col justify-center text-white">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-black uppercase tracking-tight">Scaling fast?</p>
                <p className="text-xs text-slate-400 font-medium">Upgrade to Enterprise for custom limits and priority integration.</p>
              </div>
           </div>
           <Button className="w-full h-12 font-black rounded uppercase tracking-widest active:scale-95 transition-transform bg-primary hover:bg-primary/90">
              Contact Sales
           </Button>
        </div>
      </div>
    </div>
  );
}

