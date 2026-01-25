'use client';

import React, { useState } from 'react';
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
  X,
  Zap,
  Download,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface BuilderToolbarProps {
  onTestClick?: () => void;
}

export const BuilderToolbar = ({ onTestClick }: BuilderToolbarProps) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="h-16 border-b bg-gradient-to-r from-white to-slate-50 dark:from-slate-950 dark:to-slate-900 px-6 flex items-center justify-between z-10 shrink-0 shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/settings/automations">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 font-bold rounded-full transition-colors"
          >
            <X size={20} />
          </Button>
        </Link>
        <div className="h-6 w-[1px] bg-border" />
        <div className="flex flex-col">
          <h1 className="text-sm font-black tracking-tight flex items-center gap-2">
            <span>New Automation Workflow</span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          </h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Unsaved Changes
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Redo2 size={16} />
          </Button>
        </div>

        <div className="h-6 w-[1px] bg-border" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 px-3 rounded-lg font-bold text-[11px] uppercase tracking-wider gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={onTestClick}
          >
            <Eye size={14} />
            TEST
          </Button>
          <Button
            variant="outline"
            className="h-9 px-3 rounded-lg font-bold text-[11px] uppercase tracking-wider gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Download size={14} />
            EXPORT
          </Button>
          <Button
            variant="outline"
            className="h-9 px-4 rounded-lg font-bold text-[11px] uppercase tracking-wider gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save size={14} />
            {isSaving ? 'SAVING...' : 'SAVE'}
          </Button>
          <Button className="h-10 px-6 rounded-lg font-black text-[11px] uppercase tracking-wider gap-2 shadow-lg shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white">
            <Zap size={14} className="fill-current" />
            GO LIVE
          </Button>
        </div>
      </div>
    </div>
  );
};
