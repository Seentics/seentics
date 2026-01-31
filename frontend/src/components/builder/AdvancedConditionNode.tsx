'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  GitBranch,
  Infinity,
  MoreVertical,
  Clock,
  Users,
  CheckCircle2,
  Activity,
  Scroll,
} from 'lucide-react';

const getConditionIcon = (conditionType: string) => {
  const icons: Record<string, any> = {
    if: GitBranch,
    wait: Clock,
    property: Users,
    behavior: Activity,
    timeWindow: Clock,
    eventCheck: Activity,
    scroll: Scroll,
  };
  return icons[conditionType] || GitBranch;
};

const getConditionColor = (conditionType: string) => {
  const colors: Record<string, string> = {
    if: 'bg-purple-500/10 text-purple-600',
    wait: 'bg-amber-500/10 text-amber-600',
    property: 'bg-blue-500/10 text-blue-600',
    behavior: 'bg-pink-500/10 text-pink-600',
    timeWindow: 'bg-orange-500/10 text-orange-600',
    eventCheck: 'bg-rose-500/10 text-rose-600',
    scroll: 'bg-lime-500/10 text-lime-600',
  };
  return colors[conditionType] || 'bg-purple-500/10 text-purple-600';
};

export const AdvancedConditionNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const conditionType = data.config?.conditionType || data.conditionType || 'if';
  const Icon = getConditionIcon(conditionType);
  const colorClass = getConditionColor(conditionType);

  return (
    <div
      className={`p-3 rounded border w-[220px] transition-all ${
        selected
          ? 'bg-slate-800 border-purple-500 ring-2 ring-purple-500/20 scale-105 z-50 shadow-xl shadow-purple-500/10'
          : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!w-2 !h-2 !bg-primary !border-slate-900 !border-2"
        style={{ top: -4 }}
      />

      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-700/50 ${colorClass}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
            Logic
          </p>
          <h4 className="text-xs font-black text-slate-200 truncate leading-tight">
            {data.label}
          </h4>
        </div>
      </div>

      {/* TRUE Output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        isConnectable={isConnectable}
        className="!w-2 !h-2 !bg-green-500 !border-slate-900 !border-2"
        style={{ left: '35%', bottom: -4 }}
      />
      
      {/* FALSE Output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        isConnectable={isConnectable}
        className="!w-2 !h-2 !bg-red-500 !border-slate-900 !border-2"
        style={{ left: '65%', bottom: -4 }}
      />
    </div>
  );
});

AdvancedConditionNode.displayName = 'AdvancedConditionNode';
