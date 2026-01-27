'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch, Check, X } from 'lucide-react';

export const ConditionNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  return (
    <div
      className={`relative px-4 py-3 rounded-2xl bg-slate-900 border-2 transition-all min-w-[200px] shadow-xl hover:shadow-2xl ${
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

      <div className="flex items-center gap-4 mb-3">
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
          <GitBranch size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500/80 mb-0.5">
            Logic Split
          </p>
          <h4 className="text-sm font-black text-white truncate leading-tight">
            {data.label || 'Condition Check'}
          </h4>
        </div>
      </div>

      {data.label && data.label !== 'Condition Check' && (
        <div className="bg-slate-800/50 rounded-xl p-2 text-xs font-bold text-slate-400 border border-slate-700/50 text-center mb-2 italic">
          {data.label}
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

ConditionNode.displayName = 'ConditionNode';
