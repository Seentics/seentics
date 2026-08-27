'use client';

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Zap, Mail, Webhook, Bell, MousePointer, MessageSquare, Eye, Code2, Globe, Clock, AlertTriangle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRIGGER_ICONS: Record<string, any> = {
  page_view: Globe,
  custom_event: Zap,
  exit_intent: MousePointer,
  inactivity: Clock,
  error_rate: AlertTriangle,
  goal_reached: Target,
};

export const TriggerNode = memo(({ data, selected }: any) => {
  const Icon = TRIGGER_ICONS[data.triggerType] || Zap;
  const path =
    typeof data.pageUrlMatch === 'string' && data.pageUrlMatch.trim() !== ''
      ? data.pageUrlMatch.trim()
      : null;
  const rate =
    data.rateLimitSec != null && data.rateLimitSec !== ''
      ? String(data.rateLimitSec)
      : null;

  return (
    <div className={cn(
      "px-4 py-3 rounded-lg bg-card border-2 shadow-sm min-w-[220px] transition-all",
      selected ? "border-primary ring-4 ring-primary/10" : "border-border hover:border-primary/40"
    )}>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Trigger</p>
          <p className="text-sm font-semibold truncate">{data.label || 'Select Trigger'}</p>
          {(path || rate) ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {path ? <span className="truncate block font-mono">{path}</span> : null}
              {path && rate ? <span className="text-muted-foreground/70"> · </span> : null}
              {rate ? <span>{rate}s cooldown</span> : null}
            </p>
          ) : null}
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-primary border-4 border-background" 
      />
    </div>
  );
});

export const ActionNode = memo(({ data, selected }: any) => {
  const ICON_MAP: Record<string, any> = {
    email: Mail,
    webhook: Webhook,
    banner: Bell,
    modal: MessageSquare,
    notification: Bell,
    redirect: MousePointer,
    hide_element: Eye,
    script: Code2,
  };
  const Icon = ICON_MAP[data.actionType] || Zap;

  return (
    <div className={cn(
      "px-4 py-3 rounded-lg bg-card border-2 shadow-sm min-w-[220px] transition-all",
      selected ? "border-indigo-500 ring-4 ring-indigo-500/10" : "border-border hover:border-indigo-500/40"
    )}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-indigo-500 border-4 border-background" 
      />
      
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Action</p>
          <p className="text-sm font-semibold truncate">{data.label || 'Select Action'}</p>
          {typeof data.configPayload === 'string' && data.configPayload.trim() !== '' ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {data.configPayload.trim().slice(0, 80)}
              {data.configPayload.trim().length > 80 ? '…' : ''}
            </p>
          ) : null}
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-indigo-500 border-4 border-background opacity-40 hover:opacity-100" 
      />
    </div>
  );
});

export const ConditionNode = memo(({ data, selected }: any) => {
  return (
    <div className={cn(
      "px-5 py-4 rounded-lg bg-card border-2 shadow-sm min-w-[180px] transition-all relative",
      selected ? "border-amber-500 ring-4 ring-amber-500/10" : "border-border hover:border-amber-500/40"
    )}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-amber-500 border-4 border-background" 
      />
      
      <div className="text-center">
        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2">Condition</p>
        <p className="text-sm font-bold leading-tight">{data.label || 'If condition...'}</p>
      </div>

      {/* True Path */}
      <div className="absolute -bottom-6 left-1/4 translate-x-1/2">
         <Handle 
            type="source" 
            position={Position.Bottom} 
            id="true"
            className="w-4 h-4 bg-emerald-500 border-4 border-background" 
        />
        <span className="text-[9px] font-black text-emerald-600 uppercase absolute -top-1 ml-4 whitespace-nowrap">Yes/True</span>
      </div>

      {/* False Path */}
      <div className="absolute -bottom-6 right-1/4 translate-x-1/2">
         <Handle 
            type="source" 
            position={Position.Bottom} 
            id="false"
            className="w-4 h-4 bg-rose-500 border-4 border-background" 
        />
        <span className="text-[9px] font-black text-rose-600 uppercase absolute -top-1 ml-4 whitespace-nowrap">No/False</span>
      </div>
    </div>
  );
});
