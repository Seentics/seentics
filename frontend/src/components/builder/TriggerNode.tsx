'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Zap,
  MousePointer2,
  Code2,
  Scroll,
  Clock,
  Webhook,
  Users,
  Activity,
} from 'lucide-react';

const getTriggerIcon = (triggerType: string) => {
  const icons: Record<string, any> = {
    pageView: Zap,
    click: MousePointer2,
    customEvent: Code2,
    scroll: Scroll,
    timeOnPage: Clock,
    webhook: Webhook,
    userProperty: Users,
    behavior: Activity,
  };
  return icons[triggerType] || Zap;
};

const getTriggerColor = (triggerType: string) => {
  const colors: Record<string, string> = {
    pageView: 'bg-amber-500/10 text-amber-600',
    click: 'bg-orange-500/10 text-orange-600',
    customEvent: 'bg-yellow-500/10 text-yellow-600',
    scroll: 'bg-lime-500/10 text-lime-600',
    timeOnPage: 'bg-green-500/10 text-green-600',
    webhook: 'bg-cyan-500/10 text-cyan-600',
    userProperty: 'bg-blue-500/10 text-blue-600',
    behavior: 'bg-purple-500/10 text-purple-600',
  };
  return colors[triggerType] || 'bg-amber-500/10 text-amber-600';
};

export const TriggerNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const triggerType = data.config?.triggerType || data.triggerType || 'pageView';
  const Icon = getTriggerIcon(triggerType);
  const colorClass = getTriggerColor(triggerType);

  return (
    <div
      className={`px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all shadow-sm hover:shadow-md ${
        selected
          ? 'border-primary shadow-lg ring-4 ring-primary/10 scale-105'
          : 'border-border hover:border-amber-500/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-[140px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-0.5">
            Event Trigger
          </p>
          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
            {data.label}
          </h4>
          {data.config?.page && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {data.config.page}
            </p>
          )}
        </div>
      </div>

      {data.config && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
          {data.config.scrollDepth && (
            <p className="text-[9px] text-muted-foreground">
              📊 {data.config.scrollDepth}% scroll depth
            </p>
          )}
          {data.config.duration && (
            <p className="text-[9px] text-muted-foreground">
              ⏱️ {data.config.duration} {data.config.unit}
            </p>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 !right-[-6px]"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
