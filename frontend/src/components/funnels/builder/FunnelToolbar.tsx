'use client';

import React from 'react';
import { 
  Play, 
  Save, 
  ChevronLeft,
  Settings2,
  Undo2,
  Redo2,
  X,
  Eye,
  BarChart,
  Grid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export const FunnelToolbar = () => {
  return (
    <div className="h-16 border-b bg-white dark:bg-slate-950 px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/settings/funnels">
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 font-bold rounded-full">
                <X size={20} />
            </Button>
        </Link>
        <div className="h-6 w-[1px] bg-border" />
        <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight flex items-center gap-2">
                New Conversion Funnel
                <Badge variant="outline" className="border-emerald-500/20 text-emerald-600 bg-emerald-500/10 text-[9px] font-black h-5 px-2">DRAFT</Badge>
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Auto-saved 2m ago</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
             <Button variant="ghost" size="sm" className="h-9 px-3 rounded-xl text-slate-500 gap-2 font-bold text-[11px] uppercase tracking-wider">
                <Grid size={14} />
                Snap
            </Button>
            <div className="h-4 w-[1px] bg-border mx-2" />
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
                <Eye size={14} />
                Preview
            </Button>
            <Button variant="brand" className="h-10 px-6 rounded-xl font-black text-[11px] uppercase tracking-wider gap-2 shadow-lg shadow-primary/20 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Save size={14} className="fill-current" />
                Save Funnel
            </Button>
        </div>
      </div>
    </div>
  );
};
