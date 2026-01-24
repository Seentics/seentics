'use client';

import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  FileText, 
  ExternalLink,
  ShieldAlert,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function GlobalPrivacy() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privacy & Safety</h1>
          <p className="text-muted-foreground text-sm">Account-wide data protection and compliance overview.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
           <ShieldCheck className="h-4 w-4 text-emerald-600" />
           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Privacy First</span>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border rounded-3xl p-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
              <Lock className="h-32 w-32 text-indigo-500" />
           </div>
           <div className="relative z-10 max-w-xl">
              <h2 className="text-xl font-black mb-4 flex items-center gap-3">
                 Our Privacy Commitment
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                 At Seentics, your privacy—and the privacy of your users—is our highest priority. 
                 We are 100% GDPR, CCPA, and PECR compliant. We never sell your data, 
                 and we never use fingerprinting or cross-site tracking.
              </p>
              <div className="flex flex-wrap gap-3">
                 <Button variant="outline" className="h-9 px-4 font-bold text-xs rounded-xl gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Data Processing Agreement
                 </Button>
                 <Button variant="outline" className="h-9 px-4 font-bold text-xs rounded-xl gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Privacy Policy
                 </Button>
              </div>
           </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
           <div className="p-6 rounded-2xl border bg-card hover:shadow-lg hover:shadow-primary/5 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 group-hover:scale-110 transition-transform">
                 <Settings className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-bold mb-2">Website Settings</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                 Privacy settings like IP anonymization and cookie-less mode are managed per website for maximum flexibility.
              </p>
              <Button variant="ghost" className="h-8 px-0 text-xs font-bold text-primary hover:bg-transparent hover:underline px-0">
                 Manage Website Privacy
              </Button>
           </div>

           <div className="p-6 rounded-2xl border bg-card hover:shadow-lg hover:shadow-primary/5 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/20 group-hover:scale-110 transition-transform">
                 <ShieldAlert className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="text-sm font-bold mb-2">Security & Access</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                 Enable 2FA, review active sessions, and manage login settings to keep your analytics account secure.
              </p>
              <Button variant="ghost" className="h-8 px-0 text-xs font-bold text-rose-600 hover:bg-transparent hover:underline px-0">
                 Account Security Settings
              </Button>
           </div>
        </div>

        <div className="p-6 rounded-2xl border border-dashed flex flex-col items-center text-center space-y-4">
           <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <EyeOff className="h-5 w-5 text-muted-foreground" />
           </div>
           <div className="space-y-1">
              <p className="text-sm font-bold">Zero-Tracking for the Account Hub</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                 We do not track your activity within the settings or account dashboard. 
                 Your internal workflows are private.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
