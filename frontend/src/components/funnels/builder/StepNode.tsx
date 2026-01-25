'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Filter, MousePointer2, Eye } from 'lucide-react';

export const StepNode = memo(({ data, selected }: NodeProps) => {
  const Icon = data.icon || Filter;

  return (
    <div className={`relative px-4 py-4 rounded-3xl bg-white dark:bg-slate-900 border-2 transition-all min-w-[220px] ${selected ? 'border-primary shadow-xl ring-4 ring-primary/10' : 'border-border'}`}>
      <Handle
        type="target"
        position={Position.Top}
        className="w-4 h-4 bg-primary border-4 border-white dark:border-slate-900 !top-[-8px] rounded-full"
      />
      
      <div className="flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-sm">
          <Icon size={24} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-0.5">Step {data.stepIndex ? data.stepIndex + 1 : '1'}</p>
          <h4 className="text-base font-black text-slate-900 dark:text-white truncate max-w-[180px]">{data.label}</h4>
          <p className="text-[10px] font-bold text-muted-foreground mt-1">
             {data.description || 'Define step logic'}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 flex justify-between w-full text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
         <span>Visitors</span>
         <span className="text-slate-900 dark:text-white">0</span>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-4 h-4 bg-primary border-4 border-white dark:border-slate-900 !bottom-[-8px] rounded-full"
      />
    </div>
  );
});

StepNode.displayName = 'StepNode';
