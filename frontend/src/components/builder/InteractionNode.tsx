'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PanelTop, MessageSquare, BellRing, SquareAsterisk } from 'lucide-react';

export const InteractionNode = memo(({ data, selected }: NodeProps) => {
  const Icon = data.icon || PanelTop;

  return (
    <div className={`px-4 py-3 rounded-2xl bg-slate-900 border-2 transition-all shadow-xl hover:shadow-2xl ${selected ? 'border-primary ring-4 ring-primary/20 scale-105 z-50' : 'border-slate-800 hover:border-pink-500/40'}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary border-2 border-slate-900 !left-[-6px]"
      />
      
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400 shadow-lg transition-transform group-hover:scale-110">
          <Icon size={24} />
        </div>
        <div className="min-w-[140px]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-500/80 mb-0.5">Interface</p>
          <h4 className="text-sm font-black text-white truncate leading-tight">{data.label}</h4>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-primary border-2 border-slate-900 !right-[-6px]"
      />
    </div>
  );
});

InteractionNode.displayName = 'InteractionNode';
