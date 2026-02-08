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
  Clock,
} from 'lucide-react';

const getActionIcon = (actionType: string) => {
  const icons: Record<string, any> = {
    email: Mail,
    slack: MessageSquare,
    webhook: Globe,
    modal: Bell,
    banner: BarChart3,
    notification: Bell,
    redirect: Globe,
    crm: Database,
    javascript: Code2,
    analytics: Zap,
    wait: Clock,
    delay: Clock,
  };
  return icons[actionType] || Send;
};

const getActionColor = (actionType: string) => {
  const colors: Record<string, string> = {
    email: 'bg-blue-500/10 text-blue-500',
    slack: 'bg-purple-500/10 text-purple-500',
    webhook: 'bg-cyan-500/10 text-cyan-500',
    modal: 'bg-pink-500/10 text-pink-500',
    banner: 'bg-rose-500/10 text-rose-500',
    notification: 'bg-orange-500/10 text-orange-500',
    redirect: 'bg-blue-500/10 text-blue-500',
    crm: 'bg-indigo-500/10 text-indigo-600',
    javascript: 'bg-yellow-500/10 text-yellow-500',
    analytics: 'bg-green-500/10 text-green-500',
    wait: 'bg-amber-500/10 text-amber-500',
    delay: 'bg-amber-500/10 text-amber-500',
  };
  return colors[actionType] || 'bg-blue-500/10 text-blue-500';
};

export const ActionNode = memo(({ data, selected, isConnectable }: NodeProps) => {
  const actionType = data.config?.actionType || data.actionType || 'email';
  const Icon = getActionIcon(actionType);
  const colorClass = getActionColor(actionType);

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
        <div className={`h-10 w-10 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white truncate leading-none mb-1">
            {data.label}
          </p>
          <p className="text-[10px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
            {data.description || 'Workflow action'}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-primary !border-[#020617] !border-[3px] !shadow-lg"
        style={{ bottom: -6 }}
      />
    </div>
  );
});

ActionNode.displayName = 'ActionNode';
