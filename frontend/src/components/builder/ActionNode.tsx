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
      className={`px-4 py-3 rounded-2xl bg-slate-900 border-2 transition-all shadow-xl hover:shadow-2xl ${
        selected
          ? 'border-primary ring-4 ring-primary/20 scale-105 z-50'
          : 'border-slate-800 hover:border-blue-500/40'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ left: '50%', transform: 'translateX(-50%)', top: -6, width: 12, height: 12, zIndex: 10 }}
        className="!bg-primary border-2 border-slate-900"
      />

      <div className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${colorClass}`}>
          <Icon size={24} />
        </div>
        <div className="min-w-[160px]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/80 mb-0.5">
            Automation Action
          </p>
          <h4 className="text-sm font-black text-white truncate leading-tight">
            {data.label}
          </h4>
          {data.config?.to && (
            <p className="text-[9px] text-slate-400 mt-0.5 truncate italic">
              📧 {data.config.to}
            </p>
          )}
          {data.config?.webhookUrl && (
            <p className="text-[9px] text-slate-400 mt-0.5 truncate italic">
              🔗 workflow webhook
            </p>
          )}
        </div>
      </div>

      {data.config?.subject && (
        <div className="mt-3 pt-3 border-t border-slate-800/50 space-y-1">
          <p className="text-[9px] text-slate-500 truncate italic">
            {data.config.subject}
          </p>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: -6, width: 12, height: 12, zIndex: 10 }}
        className="!bg-primary border-2 border-slate-900"
      />
    </div>
  );
});

ActionNode.displayName = 'ActionNode';
