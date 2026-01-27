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

  const getOperatorLabel = () => {
    const operators: Record<string, string> = {
      equals: '==',
      contains: '∋',
      startsWith: '^=',
      endsWith: '=$',
      greaterThan: '>',
      lessThan: '<',
      between: '∈',
    };
    return operators[data.config?.operator] || '?';
  };

  return (
    <div
      className={`relative px-4 py-4 rounded-2xl bg-slate-900 border-2 transition-all min-w-[240px] shadow-xl hover:shadow-2xl ${
        selected
          ? 'border-primary ring-4 ring-primary/20 scale-105 z-50'
          : 'border-slate-800 hover:border-purple-500/40'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ left: '50%', transform: 'translateX(-50%)', top: -6, width: 12, height: 12, zIndex: 10 }}
        className="!bg-primary border-2 border-slate-900"
      />

      <div className="flex items-center gap-4 mb-4">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${colorClass}`}>
          <Icon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 mb-1">
            Logic Step
          </p>
          <h4 className="text-sm font-black text-white truncate leading-tight text-stroke-sm">
            {data.label}
          </h4>
        </div>
      </div>

      {data.config && (
        <div className="space-y-2">
          {data.config.field && (
            <div className="bg-slate-800/50 rounded-xl p-2.5 text-xs font-medium text-slate-300 border border-slate-700/50 mb-2">
              <div className="flex items-center gap-2 justify-between">
                <span className="truncate font-bold text-slate-400">{data.config.field}</span>
                <span className="text-purple-400 font-black">{getOperatorLabel()}</span>
                <span className="truncate text-white font-bold">{data.config.value}</span>
              </div>
            </div>
          )}

          {conditionType === 'wait' && (
            <div className="bg-slate-800/50 rounded-xl p-2.5 text-xs font-medium text-slate-300 border border-slate-700/50 mb-2">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-amber-500" />
                <span className="font-bold">Wait {data.config.delay} {data.config.unit}</span>
              </div>
            </div>
          )}

          {conditionType === 'timeWindow' && data.config.startTime && (
            <div className="bg-slate-800/50 rounded-xl p-2.5 text-xs font-medium text-slate-300 border border-slate-700/50 mb-2">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-orange-500" />
                <span className="font-bold">{data.config.startTime} - {data.config.endTime}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRUE Output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        isConnectable={isConnectable}
        style={{ left: '35%', bottom: -6, width: 12, height: 12, zIndex: 10 }}
        className="!bg-green-500 border-2 border-slate-900"
      />
      <div className="absolute left-[35%] bottom-2 -translate-x-1/2 text-[8px] font-black text-green-500/80 pointer-events-none uppercase tracking-tighter">
        True
      </div>

      {/* FALSE Output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        isConnectable={isConnectable}
        style={{ left: '65%', bottom: -6, width: 12, height: 12, zIndex: 10 }}
        className="!bg-red-500 border-2 border-slate-900"
      />
      <div className="absolute left-[65%] bottom-2 -translate-x-1/2 text-[8px] font-black text-red-500/80 pointer-events-none uppercase tracking-tighter">
        False
      </div>
    </div>
  );
});

AdvancedConditionNode.displayName = 'AdvancedConditionNode';
