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
      className={`px-4 py-3 rounded-2xl bg-slate-900 border-2 transition-all shadow-xl hover:shadow-2xl ${
        selected
          ? 'border-primary ring-4 ring-primary/20 scale-105 z-50'
          : 'border-slate-800 hover:border-amber-500/40'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${colorClass}`}>
          <Icon size={24} />
        </div>
        <div className="min-w-[160px]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80 mb-1">
            Event Trigger
          </p>
          <h4 className="text-sm font-black text-white truncate leading-tight">
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
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: -6, width: 12, height: 12, zIndex: 10 }}
        className="!bg-primary border-2 border-slate-900"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
