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
      className={`p-3 rounded border w-[220px] transition-all ${
        selected
          ? 'bg-slate-800 border-amber-500 ring-2 ring-amber-500/20 scale-105 z-50 shadow-xl shadow-amber-500/10'
          : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded flex items-center justify-center flex-shrink-0 shadow-sm ${colorClass}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
            Trigger
          </p>
          <h4 className="text-xs font-black text-slate-200 truncate leading-tight">
            {data.label}
          </h4>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!w-2 !h-2 !bg-primary !border-slate-900 !border-2"
        style={{ bottom: -4 }}
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
