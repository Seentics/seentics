'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  GitBranch,
  Infinity as InfinityIcon,
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
  return (
    <div
      className={`p-3.5 rounded-xl border transition-all w-[240px] shadow-2xl ${
        selected
          ? 'bg-slate-900 border-primary ring-4 ring-primary/20 scale-105 z-50'
          : 'bg-slate-900/80 backdrop-blur-md border-slate-800 hover:border-slate-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-primary !border-[#020617] !border-[3px] !shadow-lg"
        style={{ top: -6 }}
      />

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 flex-shrink-0 shadow-inner border border-pink-500/20 group-hover:scale-110 transition-transform">
          <InfinityIcon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white truncate leading-none mb-1">
            {data.label || 'Advanced Logic'}
          </p>
          <p className="text-[10px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
            {data.description || 'Complex matching'}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-emerald-500 !border-[#020617] !border-[3px] !shadow-lg"
        style={{ left: '35%', bottom: -6 }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-rose-500 !border-[#020617] !border-[3px] !shadow-lg"
        style={{ left: '65%', bottom: -6 }}
      />
    </div>
  );
});
AdvancedConditionNode.displayName = 'AdvancedConditionNode';
