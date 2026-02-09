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
import { AutomationTestSandbox } from './AutomationTestSandbox';
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
  const [showTestSandbox, setShowTestSandbox] = useState(false);
  const { automation, setAutomation, saveAutomation, publishAutomation, isDirty, nodes } = useAutomationStore();
  const router = useRouter();

  const triggerCount = nodes.filter(n => n.type === 'triggerNode').length;
  const actionCount = nodes.filter(n => n.type === 'actionNode').length;
  const canSave = triggerCount === 1 && actionCount > 0;

  const handleSave = async () => {
    if (!canSave) {
      alert('Please add 1 trigger and at least 1 action before saving.');
      return;
    }
    
    try {
      setIsSaving(true);
      await saveAutomation(websiteId, automationId || undefined);
      setIsSaving(false);
      alert('Automation saved successfully!');
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Failed to save automation. Please try again.');
      setIsSaving(false);
    }
  };

  const handleTest = () => {
    if (!canSave) {
      alert('Please add 1 trigger and at least 1 action before testing.');
      return;
    }

    // Open the test sandbox modal
    setShowTestSandbox(true);
    
    if (onTestClick) {
      onTestClick();
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
    <div className="h-20 border-b-2 border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-900/95 backdrop-blur-xl px-8 flex items-center justify-between z-[110] flex-shrink-0 shadow-lg">
      <div className="flex items-center gap-4">
        <Link href={`/websites/${websiteId}/automations`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <div className="h-6 w-[1px] bg-slate-700" />
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            <Workflow size={20} />
          </div>
          <div className="flex flex-col">
            <Input 
              value={automation.name || ''} 
              onChange={(e) => setAutomation({ name: e.target.value })}
              placeholder="Untitled Workflow"
              className="h-9 px-3 border-none bg-transparent font-bold text-base focus-visible:ring-0 min-w-[300px] text-white placeholder:text-slate-600"
            />
            {isDirty && (
              <span className="text-[10px] text-amber-400 font-medium -mt-1">● Unsaved changes</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Workflow Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${canSave ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
            <span className="text-xs font-medium text-slate-300">
              {triggerCount} Trigger • {actionCount} Action{actionCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="h-6 w-[1px] bg-slate-700" />

        <Button
          variant="secondary"
          className="h-10 px-4 rounded font-semibold text-sm text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700 hover:border-slate-600 transition-all"
          onClick={handleTest}
          disabled={!canSave}
        >
          <Play size={16} className="text-green-500" />
          Test Automation
        </Button>
        
        <Button
          variant="default"
          className="h-10 px-5 rounded font-bold text-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          onClick={handleSave}
          disabled={isSaving || !canSave}
        >
          <Save size={16} className="" />
          {isSaving ? 'Saving Automation...' : 'Save Automation'}
        </Button>
      </div>

      <AutomationTestSandbox
        isOpen={showTestSandbox}
        onClose={() => setShowTestSandbox(false)}
        automation={{
          id: automation.id,
          name: automation.name,
          trigger: nodes.find(n => n.type === 'triggerNode')?.data,
          conditions: nodes.filter(n => n.type === 'conditionNode').map(n => n.data),
          actions: nodes.filter(n => n.type === 'actionNode').map(n => n.data)
        }}
        websiteId={websiteId}
      />
    </div>
  );
};
