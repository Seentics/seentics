'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Zap, Check } from 'lucide-react';

export default function AccountBillingSettings() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Billing</h1>
        <p className="text-muted-foreground text-sm">Main subscription and payment methods for all your websites.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/5 to-indigo-500/5 border border-primary/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Zap className="h-24 w-24 text-primary" />
            </div>
            <div className="relative z-10">
              <Badge className="mb-4 bg-primary/10 text-primary border-none font-bold text-[10px] uppercase tracking-widest px-3 h-6">Current: Pro Plan</Badge>
              <h2 className="text-3xl font-black mb-2">$49 <span className="text-sm font-medium text-muted-foreground">/ month</span></h2>
              <p className="text-sm text-muted-foreground mb-6">Your next billing date is Feb 24, 2026</p>
              
              <div className="flex flex-wrap gap-2">
                 <Button className="h-10 px-6 font-bold rounded-xl shadow-lg shadow-primary/20">Upgrade Plan</Button>
                 <Button variant="outline" className="h-10 px-6 font-bold rounded-xl">View Invoices</Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Payment Method</h3>
             <div className="flex items-center justify-between p-4 rounded-2xl border bg-muted/10 group hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-8 bg-background border rounded-md flex items-center justify-center shadow-sm">
                      <span className="text-[10px] font-black italic">VISA</span>
                   </div>
                   <div>
                      <p className="text-sm font-bold">Visa ending in 4242</p>
                      <p className="text-[10px] text-muted-foreground">Expires 04/2028</p>
                   </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold rounded-lg px-3">Edit</Button>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-muted/30 p-6 rounded-3xl border border-dashed space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest">Plan Highlights</h4>
              <ul className="space-y-3">
                 {[
                   '1M events/mo',
                   'Unlimited sites',
                   'Priority support',
                   'Advanced API access'
                 ].map((f, i) => (
                   <li key={i} className="flex items-center gap-3 text-xs font-medium">
                      <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                         <Check className="h-2.5 w-2.5 text-primary" />
                      </div>
                      {f}
                   </li>
                 ))}
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
