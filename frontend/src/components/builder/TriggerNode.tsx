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
    pageView: 'bg-amber-500/10 text-amber-500',
    click: 'bg-orange-500/10 text-orange-500',
    customEvent: 'bg-yellow-500/10 text-yellow-500',
    scroll: 'bg-lime-500/10 text-lime-500',
    timeOnPage: 'bg-green-500/10 text-green-500',
    webhook: 'bg-cyan-500/10 text-cyan-500',
    userProperty: 'bg-blue-500/10 text-blue-500',
    behavior: 'bg-purple-500/10 text-purple-500',
  };
  return colors[triggerType] || 'bg-amber-500/10 text-amber-500';
};

export const TriggerNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const triggerType = data.config?.triggerType || data.triggerType || 'pageView';
  const Icon = getTriggerIcon(triggerType);
  const colorClass = getTriggerColor(triggerType);

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all w-[240px] shadow-2xl ${
        selected
          ? 'bg-slate-900 border-primary ring-4 ring-primary/20 scale-105 z-50 shadow-primary/20'
          : 'bg-slate-900/80 backdrop-blur-md border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0 shadow-inner`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-1.5">
            Trigger
          </p>
          <h4 className="text-[13px] font-extrabold text-white truncate leading-none">
            {data.label}
          </h4>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-primary !border-[#020617] !border-[3px] !shadow-lg"
        style={{ bottom: -6 }}
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
