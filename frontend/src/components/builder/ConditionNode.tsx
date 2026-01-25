'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch, Check, X } from 'lucide-react';

export const ConditionNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  return (
    <div
      className={`relative px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all min-w-[200px] shadow-sm hover:shadow-md ${
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
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
          <GitBranch size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-0.5">
            Logic Split
          </p>
          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
            {data.label || 'Condition Check'}
          </h4>
        </div>
      </div>

      {data.label && data.label !== 'Condition Check' && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 text-xs font-medium text-muted-foreground border border-border/50 text-center mb-2">
          {data.label}
        </div>
      )}

      <div className="absolute -right-3 top-[30%] flex items-center">
        <div className="mr-2 text-[9px] font-black text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800">
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

      <div className="absolute -right-3 bottom-[30%] flex items-center">
        <div className="mr-2 text-[9px] font-black text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">
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

ConditionNode.displayName = 'ConditionNode';
