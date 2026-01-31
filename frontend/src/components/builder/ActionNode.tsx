'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Mail,
  Send,
  MessageSquare,
  Database,
  Globe,
  Code2,
  Bell,
  BarChart3,
  Zap,
} from 'lucide-react';

const getActionIcon = (actionType: string) => {
  const icons: Record<string, any> = {
    email: Mail,
    slack: MessageSquare,
    webhook: Globe,
    modal: Bell,
    banner: BarChart3,
    crm: Database,
    javascript: Code2,
    analytics: Zap,
  };
  return icons[actionType] || Send;
};

const getActionColor = (actionType: string) => {
  const colors: Record<string, string> = {
    email: 'bg-blue-500/10 text-blue-600',
    slack: 'bg-purple-500/10 text-purple-600',
    webhook: 'bg-cyan-500/10 text-cyan-600',
    modal: 'bg-pink-500/10 text-pink-600',
    banner: 'bg-rose-500/10 text-rose-600',
    crm: 'bg-indigo-500/10 text-indigo-600',
    javascript: 'bg-yellow-500/10 text-yellow-600',
    analytics: 'bg-green-500/10 text-green-600',
  };
  return colors[actionType] || 'bg-blue-500/10 text-blue-600';
};

export const ActionNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const actionType = data.config?.actionType || data.actionType || 'email';
  const Icon = getActionIcon(actionType);
  const colorClass = getActionColor(actionType);

  return (
    <div
      className={`p-3 rounded border w-[220px] transition-all ${
        selected
          ? 'bg-slate-800 border-primary ring-2 ring-primary/20 scale-105 z-50 shadow-xl shadow-primary/10'
          : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700/50'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!w-2 !h-2 !bg-primary !border-slate-900 !border-2"
        style={{ top: -4 }}
      />

      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded flex items-center justify-center flex-shrink-0 shadow-sm ${colorClass}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
            Action
          </p>
          <h4 className="text-xs font-black text-slate-200 truncate leading-tight">
            {data.label}
          </h4>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!w-2 !h-2 !bg-primary !border-slate-900 !border-2"
        style={{ bottom: -4 }}
      />
    </div>
  );
});

ActionNode.displayName = 'ActionNode';
