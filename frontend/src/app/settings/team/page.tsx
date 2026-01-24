'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AccountTeamSettings() {
  return (
    <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl shadow-primary/5">
        <Users className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Account Teams</h1>
        <p className="text-muted-foreground text-sm max-w-[400px]">
          Seentics teams are managed per website to provide granular access control.
          Select a website from the list to manage its collaborators.
        </p>
      </div>
      <Link href="/settings">
        <Button className="h-11 px-8 font-bold rounded-2xl shadow-lg shadow-primary/20 gap-2">
          View All Websites
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
