'use client';

import React, { useState } from 'react';
import {
  Search,
  Workflow,
  Zap,
  MousePointer2,
  Scroll,
  Clock,
  Code2,
  Users,
  Activity,
  Globe,
  Mail,
  MessageSquare,
  Bell,
  BarChart3,
  Database,
  Copy,
  GitBranch,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const TRIGGER_TYPES = [
  {
    type: 'pageView',
    label: 'Page View',
    icon: Zap,
    color: 'amber',
    description: 'Triggers when a user visits a specific page',
  },
  {
    type: 'click',
    label: 'Button Click',
    icon: MousePointer2,
    color: 'orange',
    description: 'Triggers when a specific button/element is clicked',
  },
  {
    type: 'scroll',
    label: 'Scroll Depth',
    icon: Scroll,
    color: 'lime',
    description: 'Triggers when user scrolls to a specific depth',
  },
  {
    type: 'timeOnPage',
    label: 'Time on Page',
    icon: Clock,
    color: 'green',
    description: 'Triggers after user spends X time on page',
  },
  {
    type: 'customEvent',
    label: 'Custom Event',
    icon: Code2,
    color: 'yellow',
    description: 'Triggers on a custom analytics event',
  },
  {
    type: 'webhook',
    label: 'Incoming Webhook',
    icon: Globe,
    color: 'cyan',
    description: 'Triggers on external HTTP request',
  },
];

const LOGIC_TYPES = [
  {
    type: 'if',
    label: 'Logic Split (If/Else)',
    icon: GitBranch,
    color: 'purple',
  },
  {
    type: 'wait',
    label: 'Wait / Delay',
    icon: Clock,
    color: 'amber',
  },
  {
    type: 'property',
    label: 'User Property Check',
    icon: Users,
    color: 'blue',
  },
  {
    type: 'eventCheck',
    label: 'Event History Check',
    icon: Activity,
    color: 'pink',
  },
  {
    type: 'timeWindow',
    label: 'Time Window',
    icon: Clock,
    color: 'orange',
  },
];

const ACTION_TYPES = [
  {
    type: 'email',
    label: 'Send Email',
    icon: Mail,
    color: 'blue',
    description: 'Send an automated email to user or team',
  },
  {
    type: 'slack',
    label: 'Slack Notification',
    icon: MessageSquare,
    color: 'purple',
    description: 'Post a message to a Slack channel',
  },
  {
    type: 'webhook',
    label: 'HTTP Webhook',
    icon: Globe,
    color: 'cyan',
    description: 'Send an outgoing webhook request',
  },
  {
    type: 'modal',
    label: 'Show Modal',
    icon: Bell,
    color: 'pink',
    description: 'Display a popup modal to the user',
  },
  {
    type: 'banner',
    label: 'Floating Banner',
    icon: BarChart3,
    color: 'rose',
    description: 'Show a persistent banner message',
  },
  {
    type: 'javascript',
    label: 'Execute JavaScript',
    icon: Code2,
    color: 'yellow',
    description: 'Run custom JavaScript code',
  },
];

export const EnhancedBuilderSidebar = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string, subtype?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    if (subtype) {
      event.dataTransfer.setData('application/reactflow-subtype', subtype);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredTriggers = TRIGGER_TYPES.filter((t) =>
    t.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredLogic = LOGIC_TYPES.filter((l) =>
    l.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredActions = ACTION_TYPES.filter((a) =>
    a.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500/10 text-amber-600',
    orange: 'bg-orange-500/10 text-orange-600',
    lime: 'bg-lime-500/10 text-lime-600',
    green: 'bg-green-500/10 text-green-600',
    yellow: 'bg-yellow-500/10 text-yellow-600',
    blue: 'bg-blue-500/10 text-blue-600',
    purple: 'bg-purple-500/10 text-purple-600',
    cyan: 'bg-cyan-500/10 text-cyan-600',
    pink: 'bg-pink-500/10 text-pink-600',
    rose: 'bg-rose-500/10 text-rose-600',
  };

  return (
    <aside className="w-72 h-full border-l border-slate-700/50 bg-slate-900 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Workflow size={20} />
          </div>
          <div>
            <h2 className="font-black text-lg tracking-tight text-white line-height-1">Nodes</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Builder Modules</p>
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search modules..."
            className="pl-10 h-11 bg-slate-800/50 border-slate-700/50 text-white shadow-none rounded-xl text-xs font-bold focus:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-8 scrollbar-hide">
        {/* Triggers */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-1">
            🎯 Event Triggers
          </p>
          <div className="grid grid-cols-1 gap-2">
            {filteredTriggers.map((trigger) => (
              <div
                key={trigger.type}
                onDragStart={(event) => onDragStart(event, 'triggerNode', trigger.label, trigger.type)}
                draggable
                className="p-3 rounded-2xl border border-slate-800 bg-slate-800/40 hover:border-amber-500/40 hover:bg-slate-800 transition-all cursor-grab active:cursor-grabbing group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl ${colorMap[trigger.color]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <trigger.icon size={18} />
                  </div>
                  <p className="text-xs font-black text-slate-300 group-hover:text-white transition-colors">
                    {trigger.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logic */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-1">
            🌿 Logic & Filters
          </p>
          <div className="grid grid-cols-1 gap-2">
            {filteredLogic.map((logic) => (
              <div
                key={logic.type}
                onDragStart={(event) => onDragStart(event, 'conditionNode', logic.label, logic.type)}
                draggable
                className="p-3 rounded-2xl border border-slate-800 bg-slate-800/40 hover:border-purple-500/40 hover:bg-slate-800 transition-all cursor-grab active:cursor-grabbing group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl ${colorMap[logic.color]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <logic.icon size={18} />
                  </div>
                  <p className="text-xs font-black text-slate-300 group-hover:text-white transition-colors">
                    {logic.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-1">
            ⚡ Actions
          </p>
          <div className="grid grid-cols-1 gap-2">
            {filteredActions.map((action) => (
              <div
                key={action.type}
                onDragStart={(event) => onDragStart(event, 'actionNode', action.label, action.type)}
                draggable
                className="p-3 rounded-2xl border border-slate-800 bg-slate-800/40 hover:border-primary/40 hover:bg-slate-800 transition-all cursor-grab active:cursor-grabbing group shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl ${colorMap[action.color]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <action.icon size={18} />
                  </div>
                  <p className="text-xs font-black text-slate-300 group-hover:text-white transition-colors">
                    {action.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
