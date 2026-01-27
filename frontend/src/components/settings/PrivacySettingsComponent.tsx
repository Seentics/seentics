'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  EyeOff, 
  Cookie, 
  Database, 
  Info,
  FileCheck
} from 'lucide-react';

export function PrivacySettingsComponent() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Privacy & GDPR</h2>
          <p className="text-muted-foreground text-sm">Configure data protection and compliance settings.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit">
           <Shield className="h-4 w-4 text-emerald-600" />
           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">GDPR Compliant</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* IP Anonymization */}
        <div className="flex items-start justify-between p-4 rounded-2xl border bg-muted/5 group transition-all hover:bg-muted/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-border/50 shrink-0">
              <EyeOff className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ip-anonymization" className="text-sm font-bold">IP Anonymization</Label>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                Automatically mask the last octet of visitor IP addresses before they are stored. Recommended for GDPR compliance.
              </p>
            </div>
          </div>
          <Switch id="ip-anonymization" defaultChecked className="mt-1" />
        </div>

        {/* Cookie-less Tracking */}
        <div className="flex items-start justify-between p-4 rounded-2xl border bg-muted/5 group transition-all hover:bg-muted/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-border/50 shrink-0">
              <Cookie className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cookie-less" className="text-sm font-bold">Cookie-less Mode</Label>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                Track unique visitors without using persistent cookies. This eliminates the need for cookie consent banners in most jurisdictions.
              </p>
            </div>
          </div>
          <Switch id="cookie-less" defaultChecked className="mt-1" />
        </div>

        {/* Data Retention */}
        <div className="p-6 border rounded-3xl bg-muted/5 space-y-4">
           <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Data Retention</h3>
           </div>
           
           <div className="grid sm:grid-cols-2 gap-4">
             <div className="p-4 rounded-xl bg-background border shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Retention Period</p>
                <div className="flex items-center justify-between">
                   <p className="text-sm font-bold">12 Months</p>
                   <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold">CHANGE</Button>
                </div>
             </div>
             <div className="p-4 rounded-xl bg-background border shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Cleanup Interval</p>
                <p className="text-sm font-bold">Standard (Weekly)</p>
             </div>
           </div>
        </div>

        <div className="flex gap-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
           <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
           <div className="space-y-1">
              <p className="text-sm font-bold">Privacy First by Default</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seentics is designed to be privacy-friendly out of the box. We never track personally identifiable information (PII) of your visitors without explicit configuration.
              </p>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-4 border-t border-border/50">
         <Button className="h-10 px-8 font-bold rounded-xl shadow-lg shadow-primary/10 transition-transform active:scale-95">
           Apply Settings
         </Button>
         <Button variant="ghost" className="h-10 px-4 font-bold rounded-xl gap-2 text-muted-foreground">
           <FileCheck className="h-4 w-4" />
           Privacy Policy Generator
         </Button>
      </div>
    </div>
  );
}
