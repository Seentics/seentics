'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PanelTop, MessageSquare, BellRing, SquareAsterisk } from 'lucide-react';

export const InteractionNode = memo(({ data, selected }: NodeProps) => {
  const Icon = data.icon || PanelTop;

  return (
    <div className={`px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all ${selected ? 'border-primary shadow-lg ring-4 ring-primary/10' : 'border-border'}`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 !left-[-6px]"
      />
      
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-600">
          <Icon size={20} />
        </div>
        <div className="min-w-[120px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-pink-600 mb-0.5">Interface</p>
          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{data.label}</h4>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 !right-[-6px]"
      />
    </div>
  );
});

InteractionNode.displayName = 'InteractionNode';
