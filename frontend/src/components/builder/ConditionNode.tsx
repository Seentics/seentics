'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch, Check, X } from 'lucide-react';

export const ConditionNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  return (
    <div
      className={`p-3.5 rounded-xl border transition-all w-[240px] shadow-2xl ${
        selected
          ? 'bg-slate-900 border-primary ring-4 ring-primary/20 scale-105 z-50 shadow-primary/20'
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
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 flex-shrink-0 shadow-inner border border-purple-500/20">
          <GitBranch size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none mb-1.5">
            Logic
          </p>
          <h4 className="text-[13px] font-extrabold text-white truncate leading-none">
            {data.label || 'Condition Check'}
          </h4>
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
