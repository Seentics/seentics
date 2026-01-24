'use client';

import React from 'react';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Trash2, ShieldAlert } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function GeneralSettings() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">General Settings</h1>
        <p className="text-muted-foreground text-sm">Update your website information and preferences.</p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="website-name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Website Name</Label>
            <Input id="website-name" placeholder="My Awesome Website" defaultValue="Seentics Dashboard" className="h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website-domain" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Domain</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="website-domain" placeholder="example.com" defaultValue="seentics.com" className="pl-10 h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button className="h-10 px-8 font-bold rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-95">
            Save Changes
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-12">
        <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-4">
          <div className="flex items-center gap-3 text-rose-600">
            <ShieldAlert className="h-5 w-5" />
            <h2 className="font-bold text-sm uppercase tracking-widest">Danger Zone</h2>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-bold">Delete Website</p>
              <p className="text-xs text-muted-foreground">This will permanently remove all analytics and historical data for this site.</p>
            </div>
            <Button variant="destructive" size="sm" className="h-9 px-4 font-bold rounded-lg border-none">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
