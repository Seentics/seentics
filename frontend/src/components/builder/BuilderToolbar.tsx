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
    <div className="h-16 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between z-[110] shrink-0">
      <div className="flex items-center gap-6">
        <Link href={`/websites/${websiteId}/automations`}>
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
          <Input 
            value={automation.name || ''} 
            onChange={(e) => setAutomation({ name: e.target.value })}
            placeholder="Workflow Name..."
            className="h-7 p-0 border-none bg-transparent font-black text-sm tracking-tight focus-visible:ring-0 min-w-[200px]"
          />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {isDirty ? 'Unsaved Changes' : 'All changes saved'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <Redo2 size={16} />
          </Button>
        </div>

        <div className="h-6 w-[1px] bg-border" />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 px-3 rounded font-bold text-[11px] uppercase tracking-wider gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={onTestClick}
          >
            <Eye size={14} />
            TEST
          </Button>
          <Button
            variant="outline"
            className="h-9 px-3 rounded font-bold text-[11px] uppercase tracking-wider gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Download size={14} />
            EXPORT
          </Button>
          <Button
            variant="outline"
            className="h-9 px-4 rounded font-bold text-[11px] uppercase tracking-wider gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save size={14} />
            {isSaving ? 'SAVING...' : 'SAVE'}
          </Button>
          <Button className="h-10 px-6 rounded font-black text-[11px] uppercase tracking-wider gap-2 shadow-lg shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white">
            <Zap size={14} className="fill-current" />
            GO LIVE
          </Button>
        </div>
      </div>
    </div>
  );
};
