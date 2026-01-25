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
} from 'lucide-react';

const getConditionIcon = (conditionType: string) => {
  const icons: Record<string, any> = {
    if: GitBranch,
    and: Infinity,
    or: MoreVertical,
    timeWindow: Clock,
    userBehavior: Users,
    property: CheckCircle2,
  };
  return icons[conditionType] || GitBranch;
};

const getConditionColor = (conditionType: string) => {
  const colors: Record<string, string> = {
    if: 'bg-purple-500/10 text-purple-600',
    and: 'bg-violet-500/10 text-violet-600',
    or: 'bg-indigo-500/10 text-indigo-600',
    timeWindow: 'bg-orange-500/10 text-orange-600',
    userBehavior: 'bg-pink-500/10 text-pink-600',
    property: 'bg-blue-500/10 text-blue-600',
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
      className={`relative px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all min-w-[220px] shadow-sm hover:shadow-md ${
        selected
          ? 'border-primary shadow-lg ring-4 ring-primary/10 scale-105'
          : 'border-border hover:border-purple-500/30'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 !left-[-6px]"
      />

      <div className="flex items-center gap-3 mb-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-0.5">
            Logic Split
          </p>
          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
            {data.label}
          </h4>
        </div>
      </div>

      {data.config && (
        <>
          {data.config.field && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-border/50 mb-2">
              <div className="flex items-center gap-2 justify-between">
                <span className="truncate font-semibold">{data.config.field}</span>
                <span className="text-purple-600 font-black">{getOperatorLabel()}</span>
                <span className="truncate text-slate-500">{data.config.value}</span>
              </div>
            </div>
          )}

          {conditionType === 'timeWindow' && data.config.startTime && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-border/50 mb-2">
              <div className="flex items-center gap-1">
                <span>⏰</span>
                <span>{data.config.startTime} - {data.config.endTime}</span>
              </div>
            </div>
          )}

          {conditionType === 'userBehavior' && data.config.behaviorType && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-border/50 mb-2">
              <div className="flex items-center gap-1">
                <span>👤</span>
                <span className="capitalize font-semibold">{data.config.behaviorType}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* TRUE Output */}
      <div className="absolute -right-3 top-[35%] flex items-center justify-end gap-1.5">
        <div className="text-[9px] font-black text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded border border-green-200 dark:border-green-800">
          TRUE
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          isConnectable={isConnectable}
          className="w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 !right-0 !top-0 !transform-none"
        />
      </div>

      {/* FALSE Output */}
      <div className="absolute -right-3 bottom-[35%] flex items-center justify-end gap-1.5">
        <div className="text-[9px] font-black text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 px-2 py-1 rounded border border-red-200 dark:border-red-800">
          FALSE
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          isConnectable={isConnectable}
          className="w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 !right-0 !top-0 !transform-none"
        />
      </div>
    </div>
  );
});

AdvancedConditionNode.displayName = 'AdvancedConditionNode';
