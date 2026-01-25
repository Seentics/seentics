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
      className={`px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border-2 transition-all shadow-sm hover:shadow-md ${
        selected
          ? 'border-primary shadow-lg ring-4 ring-primary/10 scale-105'
          : 'border-border hover:border-blue-500/30'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 !left-[-6px]"
      />

      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-[140px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-0.5">
            Automation Action
          </p>
          <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
            {data.label}
          </h4>
          {data.config?.to && (
            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
              📧 {data.config.to}
            </p>
          )}
          {data.config?.webhookUrl && (
            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
              🔗 webhook
            </p>
          )}
        </div>
      </div>

      {data.config?.subject && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
          <p className="text-[9px] text-muted-foreground truncate">
            {data.config.subject}
          </p>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 !right-[-6px]"
      />
    </div>
  );
});

ActionNode.displayName = 'ActionNode';
