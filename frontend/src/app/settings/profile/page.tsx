'use client';

import React from 'react';
import { useAuth } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, User as UserIcon, Camera, ShieldCheck } from 'lucide-react';

export default function ProfileSettings() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Personal Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your account information and how you appear on Seentics.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-8 items-start">
        <div className="relative group">
           <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
             <AvatarImage src={(user as any)?.user_metadata?.avatar_url} />
             <AvatarFallback className="text-2xl font-black bg-primary/10 text-primary">
               {user?.email?.charAt(0).toUpperCase()}
             </AvatarFallback>
           </Avatar>
           <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-lg border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-4 w-4" />
           </Button>
        </div>

        <div className="flex-1 w-full space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input defaultValue="Shohag Miah" className="pl-10 h-11 bg-muted/20 border-none shadow-none focus-visible:ring-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input defaultValue={user?.email || ''} disabled className="pl-10 h-11 bg-muted/10 border-none shadow-none opacity-60" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-dashed">
            <Button className="h-10 px-8 font-bold rounded-xl shadow-lg shadow-primary/20 transition-transform active:scale-95">
              Update Profile
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4">
         <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="h-6 w-6" />
         </div>
         <div className="flex-1">
            <p className="text-sm font-bold">Two-Factor Authentication</p>
            <p className="text-xs text-muted-foreground">Add an extra layer of security to your account by enabling 2FA.</p>
         </div>
         <Button variant="outline" size="sm" className="h-9 px-4 font-bold border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10">
            Enable
         </Button>
      </div>
    </div>
  );
}
