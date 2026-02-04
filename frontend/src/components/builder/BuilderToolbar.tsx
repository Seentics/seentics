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
import { Input } from '@/components/ui/input';
import { useAutomationStore } from '@/stores/automationStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BuilderToolbarProps {
  websiteId: string;
  automationId?: string | null;
  onTestClick?: () => void;
}

export const BuilderToolbar = ({ 
  websiteId, 
  automationId,
  onTestClick 
}: BuilderToolbarProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const { automation, setAutomation, saveAutomation, publishAutomation, isDirty } = useAutomationStore();
  const router = useRouter();

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await saveAutomation(websiteId, automationId || undefined);
      setIsSaving(false);
    } catch (error) {
      console.error(error);
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!automationId) return;
    try {
      await publishAutomation(websiteId, automationId);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="h-16 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-6 flex items-center justify-between z-[110] sticky top-0">
      <div className="flex items-center gap-4">
        <Link href={`/websites/${websiteId}/automations`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
          >
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <div className="h-5 w-[1px] bg-slate-800" />
        <div className="flex flex-col">
          <Input 
            value={automation.name || ''} 
            onChange={(e) => setAutomation({ name: e.target.value })}
            placeholder="Untitled Workflow"
            className="h-6 p-0 border-none bg-transparent font-extrabold text-[15px] tracking-tight focus-visible:ring-0 min-w-[240px] text-white placeholder:text-slate-600"
          />
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {isDirty ? 'Unsaved Changes' : 'Cloud Synced'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 mr-2">
          <div className="flex -space-x-2">
            {[1, 2].map(i => (
              <div key={i} className="h-7 w-7 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <p className="text-[10px] font-bold text-slate-500 ml-1">Team Editing</p>
        </div>

        <div className="h-5 w-[1px] bg-slate-800" />

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="h-9 px-4 rounded-xl font-bold text-[11px] uppercase tracking-wider gap-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-transparent hover:border-slate-700"
            onClick={onTestClick}
          >
            <Play size={14} className="fill-current" />
            Simulate
          </Button>
          
          <Button
            variant="default"
            className="h-9 px-5 rounded font-black text-[11px] uppercase tracking-widest gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </Button>
        </div>
      </div>
    </div>
  );
};
