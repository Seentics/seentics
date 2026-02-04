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
    type: 'conditionNode',
    subtype: 'device',
    label: 'Device Check',
    icon: GitBranch,
    color: 'purple',
    description: 'Check if user is on Mobile, Desktop, or Tablet',
  },
  {
    type: 'conditionNode',
    subtype: 'visitor',
    label: 'Visitor Status',
    icon: Users,
    color: 'blue',
    description: 'Check if user is New or Returning',
  },
  {
    type: 'conditionNode',
    subtype: 'url_param',
    label: 'URL Parameter',
    icon: Globe,
    color: 'orange',
    description: 'Check for specific UTM or URL parameters',
  },
  {
    type: 'advancedConditionNode',
    subtype: 'segment',
    label: 'User Segment',
    icon: InfinityIcon,
    color: 'pink',
    description: 'Complex matching against user segments',
  },
  {
    type: 'conditionNode',
    subtype: 'if',
    label: 'Logic Split (If/Else)',
    icon: GitBranch,
    color: 'purple',
    description: 'Branch your workflow based on custom logic',
  },
  {
    type: 'actionNode',
    subtype: 'wait',
    label: 'Wait / Delay',
    icon: Clock,
    color: 'amber',
    description: 'Pause the workflow for a specific duration',
  },
];

const ACTION_TYPES = [
  {
    type: 'actionNode',
    subtype: 'email',
    label: 'Send Email',
    icon: Mail,
    color: 'blue',
    description: 'Send an automated email to user or team',
  },
  {
    type: 'actionNode',
    subtype: 'slack',
    label: 'Slack Notification',
    icon: MessageSquare,
    color: 'purple',
    description: 'Post a message to a Slack channel',
  },
  {
    type: 'actionNode',
    subtype: 'webhook',
    label: 'HTTP Webhook',
    icon: Globe,
    color: 'cyan',
    description: 'Send an outgoing webhook request',
  },
  {
    type: 'actionNode',
    subtype: 'modal',
    label: 'Show Modal',
    icon: Bell,
    color: 'pink',
    description: 'Display a popup modal to the user',
  },
  {
    type: 'actionNode',
    subtype: 'banner',
    label: 'Floating Banner',
    icon: BarChart3,
    color: 'rose',
    description: 'Show a persistent banner message',
  },
  {
    type: 'actionNode',
    subtype: 'notification',
    label: 'Push Notification',
    icon: Bell,
    color: 'orange',
    description: 'Show a toast notification in the browser',
  },
  {
    type: 'actionNode',
    subtype: 'redirect',
    label: 'Browser Redirect',
    icon: Globe,
    color: 'blue',
    description: 'Redirect user to another URL',
  },
  {
    type: 'actionNode',
    subtype: 'javascript',
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
    amber: 'bg-amber-500/10 text-amber-500',
    orange: 'bg-orange-500/10 text-orange-500',
    lime: 'bg-lime-500/10 text-lime-500',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
    pink: 'bg-pink-500/10 text-pink-500',
    rose: 'bg-rose-500/10 text-rose-500',
  };

  const NodeItem = ({ item, type, subtype }: { item: any; type: string; subtype?: string }) => (
    <div
      onDragStart={(event) => onDragStart(event, type, item.label, subtype)}
      draggable
      className="p-3.5 rounded border border-slate-800/50 bg-slate-800/20 hover:border-primary/50 hover:bg-slate-800 transition-all cursor-grab active:cursor-grabbing group shadow-sm flex flex-col gap-2"
    >
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg ${colorMap[item.color]} flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform`}>
          <item.icon size={18} />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-slate-200 group-hover:text-white transition-colors">
            {item.label}
          </p>
        </div>
      </div>
      <p className="text-[10px] font-medium text-slate-500 leading-relaxed group-hover:text-slate-400">
        {item.description}
      </p>
    </div>
  );

  return (
    <aside className="w-[380px] h-full border-l border-slate-800 bg-slate-950/80 backdrop-blur-xl flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Workflow size={22} className="opacity-80" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight text-white leading-none mb-1">Workflow Builder</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Modules</p>
            </div>
          </div>
        </div>

        {/* <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search modules..."
            className="pl-10 h-10 bg-slate-900/50 border-slate-800 text-white shadow-none rounded-lg text-xs font-semibold focus:ring-primary/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div> */}
      </div>

      <Tabs defaultValue="triggers" className="flex-1 flex flex-col overflow-hidden mb-2">
        <div className="px-6">
          <TabsList className="w-full bg-slate-900/50 border border-slate-800 p-1">
            <TabsTrigger value="triggers" className="flex-1 rounded font-bold text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Triggers
            </TabsTrigger>
            <TabsTrigger value="logic" className="flex-1 rounded font-bold text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Conditions
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex-1 rounded font-bold text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Actions
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <TabsContent value="triggers" className="m-0 mt-0 space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="grid grid-cols-1 gap-3">
              {filteredTriggers.map((trigger) => (
                <NodeItem key={trigger.type} item={trigger} type="triggerNode" subtype={trigger.type} />
              ))}
              {filteredTriggers.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-sm font-bold text-slate-600">No triggers found</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logic" className="m-0 mt-0 space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="grid grid-cols-1 gap-3">
              {filteredLogic.map((logic, idx) => (
                <NodeItem key={idx} item={logic} type={logic.type} subtype={logic.subtype} />
              ))}
              {filteredLogic.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-sm font-bold text-slate-600">No logic nodes found</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="m-0 mt-0 space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="grid grid-cols-1 gap-3">
              {filteredActions.map((action, idx) => (
                <NodeItem key={idx} item={action} type={action.type} subtype={action.subtype} />
              ))}
              {filteredActions.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-sm font-bold text-slate-600">No actions found</p>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
      
    </aside>
  );
};
