'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch, Check, X } from 'lucide-react';

export const ConditionNode = memo(({ data, selected, isConnectable }: NodeProps) => {
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
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 flex-shrink-0 shadow-inner border border-purple-500/20 group-hover:scale-110 transition-transform">
          <GitBranch size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white truncate leading-none mb-1">
            {data.label || 'Condition Check'}
          </p>
          <p className="text-[10px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
            {data.description || 'Workflow logic'}
          </p>
        </div>
      </div>

      {/* TRUE Output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-emerald-500 !border-[#020617] !border-[3px] !shadow-lg"
        style={{ left: '35%', bottom: -6 }}
      />
      
      {/* FALSE Output */}
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

ConditionNode.displayName = 'ConditionNode';
