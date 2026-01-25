'use client';

import React from 'react';
import { 
  Play, 
  Save, 
  Share2, 
  ChevronLeft,
  Workflow,
  Settings2,
  Undo2,
  Redo2,
  Trash2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const BuilderToolbar = () => {
  return (
    <div className="h-16 border-b bg-white dark:bg-slate-950 px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/settings/automations">
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 font-bold rounded-full">
                <X size={20} />
            </Button>
        </Link>
        <div className="h-6 w-[1px] bg-border" />
        <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight flex items-center gap-2">
                New Intelligence Workflow
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unsaved Changes</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400">
                <Undo2 size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400">
                <Redo2 size={16} />
            </Button>
        </div>
        <div className="h-6 w-[1px] bg-border" />
        <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 px-4 rounded-xl font-bold text-[11px] uppercase tracking-wider gap-2">
                <Settings2 size={14} />
                CONFIG
            </Button>
            <Button variant="brand" className="h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-wider gap-2 shadow-lg shadow-primary/20">
                <Play size={14} className="fill-current" />
                GO LIVE
            </Button>
        </div>
      </div>
    </div>
  );
};
