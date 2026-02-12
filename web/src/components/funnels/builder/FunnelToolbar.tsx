'use client';

import React from 'react';
import {
  Save,
  Undo2,
  Redo2,
  X,
  Eye,
  Grid,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface FunnelToolbarProps {
  name: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  isSaving: boolean;
  websiteId: string;
}

export const FunnelToolbar = ({ name, onNameChange, onSave, isSaving, websiteId }: FunnelToolbarProps) => {
  return (
    <div className="h-16 border-b bg-white dark:bg-slate-950 px-6 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-6">
        <Link href={`/websites/${websiteId}/funnels`}>
          <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 font-bold rounded-full">
            <X size={20} />
          </Button>
        </Link>
        <div className="h-6 w-[1px] bg-border" />
        <div className="flex flex-col">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="bg-transparent border-none focus:outline-none text-sm font-black tracking-tight flex items-center gap-2"
            placeholder="Funnel Name"
          />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Editing Journey</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-9 px-3 rounded text-slate-500 gap-2 font-bold text-[11px] uppercase tracking-wider">
            <Grid size={14} />
            Snap
          </Button>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded text-slate-400">
            <Undo2 size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded text-slate-400">
            <Redo2 size={16} />
          </Button>
        </div>
        <div className="h-6 w-[1px] bg-border" />
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 px-4 rounded font-bold text-[11px] uppercase tracking-wider gap-2">
            <Eye size={14} />
            Preview
          </Button>
          <Button
            variant="brand"
            className="h-10 px-6 rounded font-black text-[11px] uppercase tracking-wider gap-2 shadow-lg shadow-primary/20 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} className="fill-current" />
            )}
            {isSaving ? 'Saving...' : 'Save Funnel'}
          </Button>
        </div>
      </div>
    </div>
  );
};
