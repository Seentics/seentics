'use client';

import React, { useState } from 'react';
import {
  Play,
  Save,
  ChevronLeft,
  Workflow,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAutomationStore } from '@/stores/automationStore';
import { AutomationTestSandbox } from './AutomationTestSandbox';
import Link from 'next/link';

interface BuilderToolbarProps {
  websiteId: string;
  automationId?: string | null;
  onTestClick?: () => void;
}

export const BuilderToolbar = ({
  websiteId,
  automationId,
  onTestClick,
}: BuilderToolbarProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [showTestSandbox, setShowTestSandbox] = useState(false);
  const { automation, setAutomation, saveAutomation, publishAutomation, isDirty, nodes } = useAutomationStore();

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
    <div className="h-14 border-b border-white/[0.06] bg-zinc-950/95 backdrop-blur-xl px-4 flex items-center justify-between z-[110] flex-shrink-0">
      {/* Left: nav + name */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href={`/websites/${websiteId}/automations`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/[0.06] rounded-md"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="h-4 w-px bg-white/[0.06]" />
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Workflow className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Input
            value={automation.name || ''}
            onChange={(e) => setAutomation({ name: e.target.value })}
            placeholder="Untitled Workflow"
            className="h-8 px-2 border-none bg-transparent text-sm font-medium focus-visible:ring-0 min-w-[200px] max-w-[300px] text-white placeholder:text-zinc-600"
          />
          {isDirty && (
            <span className="text-[10px] text-amber-400/80 font-medium whitespace-nowrap flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
              Unsaved
            </span>
          )}
        </div>
      </div>

      {/* Right: status + actions */}
      <div className="flex items-center gap-2">
        {/* Status pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] rounded-md border border-white/[0.06]">
          <span className={`h-1.5 w-1.5 rounded-full ${canSave ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-[11px] font-medium text-zinc-400">
            {triggerCount}T · {actionCount}A
          </span>
        </div>

        <div className="h-4 w-px bg-white/[0.06]" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] gap-1.5"
          onClick={handleTest}
          disabled={!canSave}
        >
          <Play className="h-3 w-3 text-emerald-500" />
          Test
        </Button>

        <Button
          size="sm"
          className="h-8 px-4 text-xs font-medium gap-1.5"
          onClick={handleSave}
          disabled={isSaving || !canSave}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          {isSaving ? 'Saving...' : 'Save'}
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
          actions: nodes.filter(n => n.type === 'actionNode').map(n => n.data),
        }}
        websiteId={websiteId}
      />
    </div>
  );
};
