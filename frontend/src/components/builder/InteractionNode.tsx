'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PanelTop, MessageSquare, BellRing, SquareAsterisk } from 'lucide-react';

export const InteractionNode = memo(({ data, selected }: NodeProps) => {
  const Icon = data.icon || PanelTop;

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
        className="!w-3 !h-3 !bg-primary !border-[#020617] !border-[3px] !shadow-lg"
        style={{ top: -6 }}
      />
      
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 flex-shrink-0 shadow-inner border border-pink-500/20 group-hover:scale-110 transition-transform">
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white truncate leading-none mb-1">
            {data.label}
          </p>
          <p className="text-[10px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
            {data.description || 'UI overlay interaction'}
          </p>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-[#020617] !border-[3px] !shadow-lg"
        style={{ bottom: -6 }}
      />
    </div>
  );
});

InteractionNode.displayName = 'InteractionNode';
